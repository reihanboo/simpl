package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"

	mcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

// maxToolRounds caps how many tool-use rounds a single answer may take.
const maxToolRounds = 4

// Message is one turn of prior conversation supplied by the client.
type Message struct {
	Role    string
	Content string
}

// ToolInvocation records one MCP tool call the model made while answering.
type ToolInvocation struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
	Result    string `json:"result,omitempty"`
	Error     string `json:"error,omitempty"`
}

// Answer is the assistant's reply plus the tool calls it used.
type Answer struct {
	Reply     string           `json:"reply"`
	ToolCalls []ToolInvocation `json:"tool_calls,omitempty"`
}

// Ask runs the DeepSeek tool-calling loop against an in-process MCP server
// bound to scope, and returns the natural-language reply.
func Ask(ctx context.Context, scope Scope, history []Message, question string) (Answer, error) {
	client := newDeepSeekClient()
	if client.apiKey == "" {
		return Answer{}, ErrNotConfigured
	}

	server := NewServer(scope)
	serverTransport, clientTransport := mcp.NewInMemoryTransports()

	serverSession, err := server.Connect(ctx, serverTransport, nil)
	if err != nil {
		return Answer{}, fmt.Errorf("connect mcp server: %w", err)
	}
	defer serverSession.Close()

	mcpClient := mcp.NewClient(&mcp.Implementation{Name: "simpl-backend", Version: "1.0.0"}, nil)
	session, err := mcpClient.Connect(ctx, clientTransport, nil)
	if err != nil {
		return Answer{}, fmt.Errorf("connect mcp client: %w", err)
	}
	defer session.Close()

	toolsResult, err := session.ListTools(ctx, nil)
	if err != nil {
		return Answer{}, fmt.Errorf("list mcp tools: %w", err)
	}
	tools := toChatTools(toolsResult.Tools)

	messages := make([]chatMessage, 0, len(history)+2)
	messages = append(messages, chatMessage{Role: "system", Content: systemPrompt(scope)})
	for _, message := range history {
		if message.Content == "" || (message.Role != "user" && message.Role != "assistant") {
			continue
		}
		messages = append(messages, chatMessage{Role: message.Role, Content: message.Content})
	}
	messages = append(messages, chatMessage{Role: "user", Content: question})

	answer := Answer{ToolCalls: []ToolInvocation{}}
	for round := 0; round < maxToolRounds; round++ {
		reply, err := client.complete(ctx, messages, tools)
		if err != nil {
			return Answer{}, err
		}

		if len(reply.ToolCalls) == 0 {
			answer.Reply = strings.TrimSpace(reply.Content)
			return answer, nil
		}

		messages = append(messages, chatMessage{Role: "assistant", Content: reply.Content, ToolCalls: reply.ToolCalls})
		for _, call := range reply.ToolCalls {
			invocation, toolResult := executeToolCall(ctx, session, call)
			answer.ToolCalls = append(answer.ToolCalls, invocation)
			messages = append(messages, chatMessage{
				Role:       "tool",
				ToolCallID: call.ID,
				Name:       call.Function.Name,
				Content:    toolResult,
			})
		}
	}

	// Tool budget exhausted: ask once more without tools so the model must
	// produce a final answer from what it already gathered.
	reply, err := client.complete(ctx, messages, nil)
	if err != nil {
		return Answer{}, err
	}
	answer.Reply = strings.TrimSpace(reply.Content)
	return answer, nil
}

func executeToolCall(ctx context.Context, session *mcp.ClientSession, call toolCall) (ToolInvocation, string) {
	invocation := ToolInvocation{Name: call.Function.Name, Arguments: call.Function.Arguments}

	arguments := json.RawMessage(call.Function.Arguments)
	if len(bytes.TrimSpace(arguments)) == 0 {
		arguments = json.RawMessage(`{}`)
	}

	result, err := session.CallTool(ctx, &mcp.CallToolParams{Name: call.Function.Name, Arguments: arguments})
	if err != nil {
		invocation.Error = err.Error()
		return invocation, "error: " + err.Error()
	}

	text, isError := toolResultText(result)
	invocation.Result = text
	if isError {
		invocation.Error = text
	}
	return invocation, text
}

func toolResultText(result *mcp.CallToolResult) (string, bool) {
	if result == nil {
		return "no result", true
	}

	var builder strings.Builder
	for _, content := range result.Content {
		if text, ok := content.(*mcp.TextContent); ok {
			builder.WriteString(text.Text)
		}
	}
	if builder.Len() > 0 {
		return builder.String(), result.IsError
	}
	if result.StructuredContent != nil {
		if data, err := json.Marshal(result.StructuredContent); err == nil {
			return string(data), result.IsError
		}
	}
	return "no result", result.IsError
}

func toChatTools(tools []*mcp.Tool) []chatTool {
	converted := make([]chatTool, 0, len(tools))
	for _, tool := range tools {
		converted = append(converted, chatTool{
			Type: "function",
			Function: chatFunction{
				Name:        tool.Name,
				Description: tool.Description,
				Parameters:  tool.InputSchema,
			},
		})
	}
	return converted
}

func systemPrompt(scope Scope) string {
	return "Anda adalah ABAI, asisten operasional untuk cabang \"" + scope.BranchName + "\" pada platform SIMPL. " +
		"Jawab hanya berdasarkan data yang diperoleh lewat tool yang tersedia, dan jangan mengarang angka. " +
		"Panggil tool yang relevan sebelum menjawab. Semua data sudah dibatasi ke cabang ini; anda tidak dapat mengakses cabang atau bisnis lain. " +
		"Gunakan bahasa Indonesia yang ringkas dan profesional, format nominal sebagai Rupiah (contoh: Rp 1.250.000), dan jangan memakai emoji. " +
		"Saat menyajikan beberapa baris data (misalnya daftar produk), gunakan tabel Markdown yang rapi agar mudah dibaca. " +
		"Jika suatu informasi tidak tersedia lewat tool, sampaikan dengan jujur bahwa data tersebut belum tersedia."
}
