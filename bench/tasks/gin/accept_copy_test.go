// Copyright 2014 Manuel Martínez-Almeida. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package gin

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Acceptance, based on the regression tests of gin-gonic/gin#4695: a copy of
// the context handed to a goroutine keeps the errors and the accepted formats
// set before the copy, and changing the copy leaves the original as it was.
func TestAcceptCopyKeepsErrors(t *testing.T) {
	c, _ := CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	_ = c.Error(errors.New("first error"))
	_ = c.Error(errors.New("second error"))

	cp := c.Copy()

	require.Len(t, cp.Errors, 2)
	assert.Equal(t, "first error", cp.Errors[0].Error())
	assert.Equal(t, "second error", cp.Errors[1].Error())

	_ = cp.Error(errors.New("third error"))
	assert.Len(t, c.Errors, 2)
	assert.Len(t, cp.Errors, 3)
}

func TestAcceptCopyKeepsAccepted(t *testing.T) {
	c, _ := CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	c.SetAccepted("application/json", "text/html")

	cp := c.Copy()

	assert.Equal(t, []string{"application/json", "text/html"}, cp.Accepted)

	cp.SetAccepted("text/plain")
	assert.Equal(t, []string{"application/json", "text/html"}, c.Accepted)
	assert.Equal(t, []string{"text/plain"}, cp.Accepted)
}
