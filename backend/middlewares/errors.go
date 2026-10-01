package middlewares

import (
	"log"
	"net/http"
	"runtime/debug"

	"backend/utils"

	"github.com/gin-gonic/gin"
)

// ErrorRecovery keeps unexpected server failures in the API's JSON error format
// and logs details only on the server.
func ErrorRecovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recovered := recover(); recovered != nil {
				log.Printf("Recovered from panic: %v\n%s", recovered, debug.Stack())
				if !c.Writer.Written() {
					utils.RespondError(c, http.StatusInternalServerError, "Terjadi kesalahan pada server. Silakan coba lagi.")
				}
				c.Abort()
			}
		}()
		c.Next()
	}
}
