package controllers

import (
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestValidateOrderQuantities(t *testing.T) {
	if err := validateOrderQuantities([]OrderItemInput{{ProductID: uuid.New(), Qty: 1}, {ProductID: uuid.New(), Qty: 4}}); err != nil {
		t.Fatalf("valid quantities rejected: %v", err)
	}

	tests := []struct {
		name     string
		quantity int
	}{
		{name: "zero", quantity: 0},
		{name: "negative", quantity: -1},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateOrderQuantities([]OrderItemInput{{ProductID: uuid.New(), Qty: test.quantity}})
			if !errors.Is(err, errInvalidOrderQuantity) {
				t.Fatalf("validateOrderQuantities() error = %v, want %v", err, errInvalidOrderQuantity)
			}
		})
	}
}
