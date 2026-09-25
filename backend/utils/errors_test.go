package utils

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

func TestRespondBindErrorHumanizesValidationErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)

	input := struct {
		Email    string `json:"email" validate:"required,email"`
		Password string `json:"password" validate:"min=6"`
	}{}
	err := validator.New().Struct(input)

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	RespondBindError(context, err)

	if recorder.Code != 400 {
		t.Fatalf("expected status 400, got %d", recorder.Code)
	}
	body := recorder.Body.String()
	for _, message := range []string{"Email wajib diisi.", "Kata sandi harus terdiri dari minimal 6 karakter."} {
		if !strings.Contains(body, message) {
			t.Errorf("expected response to contain %q, got %s", message, body)
		}
	}
	if strings.Contains(body, "Key:") {
		t.Errorf("response exposed validator internals: %s", body)
	}
}
