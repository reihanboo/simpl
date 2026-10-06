package ai

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"testing"

	mcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"gorm.io/gorm/schema"
)

func TestRawQueryMoneyFieldsMatchSQLAliases(t *testing.T) {
	tests := []struct {
		name   string
		model  any
		field  string
		column string
	}{
		{name: "customer lifetime spend", model: customerSpend{}, field: "TotalSpendIDR", column: "total_spend_idr"},
		{name: "product revenue", model: productSales{}, field: "RevenueIDR", column: "revenue_idr"},
		{name: "product selling price", model: productStockItem{}, field: "SellingPriceIDR", column: "selling_price_idr"},
		{name: "daily revenue", model: dailySalesTrend{}, field: "RevenueIDR", column: "revenue_idr"},
		{name: "daily discount", model: dailySalesTrend{}, field: "DiscountIDR", column: "discount_idr"},
		{name: "payment method revenue", model: paymentMethodRow{}, field: "RevenueIDR", column: "revenue_idr"},
		{name: "payment method discount", model: paymentMethodRow{}, field: "DiscountIDR", column: "discount_idr"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			parsed, err := schema.Parse(test.model, &sync.Map{}, schema.NamingStrategy{})
			if err != nil {
				t.Fatalf("parse model schema: %v", err)
			}
			field := parsed.LookUpField(test.field)
			if field == nil {
				t.Fatalf("field %q not found", test.field)
			}
			if field.DBName != test.column {
				t.Errorf("database column = %q, want %q", field.DBName, test.column)
			}
		})
	}
}

func TestClampArg(t *testing.T) {
	tests := []struct {
		name     string
		value    int
		min      int
		max      int
		fallback int
		want     int
	}{
		{name: "unset uses fallback", value: 0, min: 1, max: 90, fallback: 7, want: 7},
		{name: "below minimum clamps up", value: -3, min: 1, max: 90, fallback: 7, want: 1},
		{name: "above maximum clamps down", value: 500, min: 1, max: 90, fallback: 7, want: 90},
		{name: "in range is preserved", value: 30, min: 1, max: 90, fallback: 7, want: 30},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := clampArg(test.value, test.min, test.max, test.fallback); got != test.want {
				t.Fatalf("clampArg() = %d, want %d", got, test.want)
			}
		})
	}
}

func TestListToolsExposesTenantAgnosticSchemas(t *testing.T) {
	ctx := context.Background()
	server := NewServer(Scope{BranchName: "Cabang Uji"})

	serverTransport, clientTransport := mcp.NewInMemoryTransports()
	serverSession, err := server.Connect(ctx, serverTransport, nil)
	if err != nil {
		t.Fatalf("connect server: %v", err)
	}
	defer serverSession.Close()

	client := mcp.NewClient(&mcp.Implementation{Name: "test-client", Version: "1.0.0"}, nil)
	session, err := client.Connect(ctx, clientTransport, nil)
	if err != nil {
		t.Fatalf("connect client: %v", err)
	}
	defer session.Close()

	result, err := session.ListTools(ctx, nil)
	if err != nil {
		t.Fatalf("list tools: %v", err)
	}

	want := map[string]bool{
		"get_sales_summary":            true,
		"get_top_products":             true,
		"get_low_stock_products":       true,
		"find_product_stock":           true,
		"get_customer_overview":        true,
		"get_restock_recommendations":  true,
		"get_sales_trend":              true,
		"get_payment_method_breakdown": true,
		"get_inventory_valuation":      true,
		"get_employee_overview":        true,
		"get_attendance_report":        true,
	}
	if len(result.Tools) != len(want) {
		t.Fatalf("got %d tools, want %d", len(result.Tools), len(want))
	}

	for _, tool := range result.Tools {
		if !want[tool.Name] {
			t.Errorf("unexpected tool %q", tool.Name)
			continue
		}
		schema, err := json.Marshal(tool.InputSchema)
		if err != nil {
			t.Fatalf("marshal schema for %s: %v", tool.Name, err)
		}
		if strings.Contains(string(schema), "branch_id") || strings.Contains(string(schema), "business_id") {
			t.Errorf("tool %s schema must not expose tenant fields: %s", tool.Name, schema)
		}
		delete(want, tool.Name)
	}
	for missing := range want {
		t.Errorf("tool %q was not registered", missing)
	}
}

func TestToChatToolsMapsSchema(t *testing.T) {
	schema := map[string]any{"type": "object"}
	converted := toChatTools([]*mcp.Tool{{Name: "demo", Description: "desc", InputSchema: schema}})

	if len(converted) != 1 {
		t.Fatalf("got %d tools, want 1", len(converted))
	}
	if converted[0].Type != "function" {
		t.Errorf("type = %q, want function", converted[0].Type)
	}
	if converted[0].Function.Name != "demo" || converted[0].Function.Description != "desc" {
		t.Errorf("function mapping lost name/description: %+v", converted[0].Function)
	}
	if converted[0].Function.Parameters == nil {
		t.Error("parameters schema was dropped")
	}
}

func TestToolResultText(t *testing.T) {
	text, isError := toolResultText(&mcp.CallToolResult{
		Content: []mcp.Content{&mcp.TextContent{Text: "halo"}},
	})
	if text != "halo" || isError {
		t.Fatalf("toolResultText() = (%q, %v), want (halo, false)", text, isError)
	}

	text, isError = toolResultText(&mcp.CallToolResult{
		Content: []mcp.Content{&mcp.TextContent{Text: "gagal"}},
		IsError: true,
	})
	if text != "gagal" || !isError {
		t.Fatalf("toolResultText() = (%q, %v), want (gagal, true)", text, isError)
	}

	text, isError = toolResultText(nil)
	if !isError || text == "" {
		t.Fatalf("toolResultText(nil) = (%q, %v), want non-empty error", text, isError)
	}
}
