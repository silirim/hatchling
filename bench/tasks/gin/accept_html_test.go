// Copyright 2014 Manuel Martínez-Almeida. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package gin

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Acceptance, based on the regression test of gin-gonic/gin#4805: rendering
// HTML on an engine with no templates loaded does not panic; the failure is
// reported to the application as an error on the context.
func TestAcceptHTMLWithoutTemplates(t *testing.T) {
	for _, method := range []string{http.MethodGet, http.MethodHead} {
		t.Run(method, func(t *testing.T) {
			router := New() // no Recovery: a panic reaches the test
			var errs []string
			router.Handle(method, "/", func(c *Context) {
				c.HTML(http.StatusOK, "index.tmpl", H{"title": "Main website"})
				errs = c.Errors.Errors()
			})
			w := httptest.NewRecorder()
			require.NotPanics(t, func() {
				router.ServeHTTP(w, httptest.NewRequest(method, "/", nil))
			})
			assert.NotEmpty(t, errs, "the missing templates must be reported as an error on the context")
		})
	}
}
