package utils

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

// RespondError sends errors in a consistent shape for every API endpoint.
func RespondError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}

// RespondBindError turns request parsing and validation failures into messages
// that users can act on, without exposing framework-specific error details.
func RespondBindError(c *gin.Context, err error) {
	var validationErrors validator.ValidationErrors
	if errors.As(err, &validationErrors) {
		messages := make([]string, 0, len(validationErrors))
		for _, fieldErr := range validationErrors {
			messages = append(messages, validationMessage(fieldErr))
		}
		RespondError(c, http.StatusBadRequest, strings.Join(messages, " "))
		return
	}

	var syntaxError *json.SyntaxError
	var typeError *json.UnmarshalTypeError
	switch {
	case errors.As(err, &syntaxError), errors.As(err, &typeError):
		RespondError(c, http.StatusBadRequest, "Format data tidak valid. Periksa kembali isian Anda.")
	default:
		RespondError(c, http.StatusBadRequest, "Data yang dikirim tidak dapat dibaca. Periksa kembali isian Anda.")
	}
}

func validationMessage(fieldErr validator.FieldError) string {
	field := fieldLabel(fieldErr.StructField(), fieldErr.Field())
	switch fieldErr.Tag() {
	case "required":
		return fmt.Sprintf("%s wajib diisi.", field)
	case "email":
		return fmt.Sprintf("Masukkan alamat email yang valid pada kolom %s.", field)
	case "min":
		if fieldErr.StructField() == "Password" || fieldErr.StructField() == "NewPassword" {
			return fmt.Sprintf("%s harus terdiri dari minimal %s karakter.", field, fieldErr.Param())
		}
		return fmt.Sprintf("%s harus berisi minimal %s karakter.", field, fieldErr.Param())
	case "max":
		return fmt.Sprintf("%s tidak boleh lebih dari %s karakter.", field, fieldErr.Param())
	case "len":
		if fieldErr.StructField() == "OTPCode" {
			return "Kode OTP harus terdiri dari 6 angka."
		}
		return fmt.Sprintf("%s harus terdiri dari %s karakter.", field, fieldErr.Param())
	case "numeric":
		return fmt.Sprintf("%s hanya boleh berisi angka.", field)
	default:
		return fmt.Sprintf("Periksa kembali kolom %s.", field)
	}
}

func fieldLabel(structField, jsonField string) string {
	knownLabels := map[string]string{
		"username":        "Nama pengguna",
		"email":           "Email",
		"phone":           "Nomor telepon",
		"password":        "Kata sandi",
		"identity":        "Email atau nama pengguna",
		"otp_code":        "Kode OTP",
		"token":           "Token",
		"new_password":    "Kata sandi baru",
		"name":            "Nama usaha",
		"plan":            "Paket",
		"duration_months": "Durasi paket",
	}
	if label, ok := knownLabels[strings.ToLower(jsonField)]; ok {
		return label
	}

	if jsonField == "" || jsonField == structField {
		jsonField = strings.ToLower(structField)
	}
	jsonField = strings.ReplaceAll(jsonField, "_", " ")
	if jsonField == "" {
		return "Data"
	}
	return strings.ToUpper(jsonField[:1]) + jsonField[1:]
}
