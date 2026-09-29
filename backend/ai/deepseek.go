package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// DeepSeekAPIKey resolves the configured key, accepting either env name.
func DeepSeekAPIKey() string {
	if key := strings.TrimSpace(os.Getenv("DEEPSEEK_API")); key != "" {
		return key
	}
	return strings.TrimSpace(os.Getenv("DEEPSEEK_API_KEY"))
}

// Configured reports whether the assistant can reach DeepSeek.
func Configured() bool {
	return DeepSeekAPIKey() != ""
}

type deepSeekClient struct {
	apiKey  string
	baseURL string
	model   string
	http    *http.Client
}

func newDeepSeekClient() *deepSeekClient {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("DEEPSEEK_BASE_URL")), "/")
	if baseURL == "" {
		baseURL = "https://api.deepseek.com"
	}
	model := strings.TrimSpace(os.Getenv("DEEPSEEK_MODEL"))
	if model == "" {
		model = "deepseek-chat"
	}
	return &deepSeekClient{
		apiKey:  DeepSeekAPIKey(),
		baseURL: baseURL,
		model:   model,
		http:    &http.Client{Timeout: 60 * time.Second},
	}
}

type chatMessage struct {
	Role       string     `json:"role"`
	Content    string     `json:"content,omitempty"`
	ToolCalls  []toolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	Name       string     `json:"name,omitempty"`
}

type toolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type chatTool struct {
	Type     string       `json:"type"`
	Function chatFunction `json:"function"`
}

type chatFunction struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Parameters  any    `json:"parameters,omitempty"`
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Tools       []chatTool    `json:"tools,omitempty"`
	Temperature float64       `json:"temperature"`
	Stream      bool          `json:"stream"`
}

type chatResponse struct {
	Choices []struct {
		Message      chatMessage `json:"message"`
		FinishReason string      `json:"finish_reason"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (c *deepSeekClient) complete(ctx context.Context, messages []chatMessage, tools []chatTool) (chatMessage, error) {
	body, err := json.Marshal(chatRequest{
		Model:       c.model,
		Messages:    messages,
		Tools:       tools,
		Temperature: 0.2,
	})
	if err != nil {
		return chatMessage{}, fmt.Errorf("encode deepseek request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return chatMessage{}, fmt.Errorf("build deepseek request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	res, err := c.http.Do(req)
	if err != nil {
		return chatMessage{}, fmt.Errorf("call deepseek: %w", err)
	}
	defer res.Body.Close()

	data, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return chatMessage{}, fmt.Errorf("read deepseek response: %w", err)
	}
	if res.StatusCode != http.StatusOK {
		return chatMessage{}, fmt.Errorf("deepseek returned status %d: %s", res.StatusCode, strings.TrimSpace(string(data)))
	}

	var parsed chatResponse
	if err := json.Unmarshal(data, &parsed); err != nil {
		return chatMessage{}, fmt.Errorf("decode deepseek response: %w", err)
	}
	if parsed.Error != nil {
		return chatMessage{}, fmt.Errorf("deepseek error: %s", parsed.Error.Message)
	}
	if len(parsed.Choices) == 0 {
		return chatMessage{}, fmt.Errorf("deepseek returned no choices")
	}

	return parsed.Choices[0].Message, nil
}
