// Copyright 2014 Manuel Martínez-Almeida. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package gin

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Acceptance, based on the regression test of gin-gonic/gin#4698: a panic
// recovered by the default recovery middleware is visible in c.Errors to the
// middlewares that run before it.
func TestAcceptRecoveryRecordsPanic(t *testing.T) {
	tests := []struct {
		name     string
		value    any
		expected string
	}{
		{"string panic", "Oops, Houston, we have a problem", "Oops, Houston, we have a problem"},
		{"error panic", errors.New("recovered error"), "recovered error"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := New()
			var seen errorMsgs
			router.Use(func(c *Context) {
				c.Next()
				seen = c.Errors
			})
			router.Use(RecoveryWithWriter(io.Discard))
			router.GET("/recovery", func(_ *Context) { panic(tt.value) })

			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/recovery", nil))

			assert.Equal(t, http.StatusInternalServerError, w.Code)
			require.Len(t, seen, 1)
			assert.Contains(t, seen[0].Error(), tt.expected)
		})
	}
}
