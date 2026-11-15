// Copyright 2014 Manuel Martínez-Almeida. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package gin

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// Acceptance, based on the regression tests of gin-gonic/gin#4819 (issue #4818):
// with HandleMethodNotAllowed on, a request that matches no route in any
// method tree must not panic, and 405 still works.
func acceptMNARouter() *Engine {
	router := New()
	router.HandleMethodNotAllowed = true
	h := func(c *Context) {}
	router.OPTIONS("/:p0/:p1/a/:p2", h)
	router.GET("/:p0/:p1/a/:p2", h)
	router.PATCH("/b/:p0/:p1/c", h)
	router.DELETE("/b/:p0/:p1/d/:p3", h)
	router.GET("/b/:p0/:p1/e/f", h)
	router.POST("/b/:p0/:p1/g/:p4/h", h)
	router.OPTIONS("/b/:p0/:p1/g/:p4/h", h)
	router.DELETE("/b/cache", h)
	router.GET("/b/clients/:p1/g", h)
	router.POST("/b/clients/:p1/g", h)
	router.PATCH("/b/clients/:p1/g/:p4", h)
	router.OPTIONS("/b/clients/:p1/g/:p4", h)
	return router
}

func acceptServe(t *testing.T, router *Engine, method, path string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("%s %s panicked: %v", method, path, r)
			}
		}()
		router.ServeHTTP(w, httptest.NewRequest(method, path, nil))
	}()
	return w
}

func TestAcceptMethodNotAllowedNoPanic(t *testing.T) {
	w := acceptServe(t, acceptMNARouter(), http.MethodPost, "/b/clients/42")
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestAcceptMethodNotAllowedStillWorks(t *testing.T) {
	w := acceptServe(t, acceptMNARouter(), http.MethodPatch, "/b/clients/42/g")
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
	if w.Header().Get("Allow") == "" {
		t.Fatal("expected Allow header to be set for 405")
	}
}

func TestAcceptMethodNotAllowedManyTrees(t *testing.T) {
	router := New()
	router.HandleMethodNotAllowed = true
	h := func(c *Context) {}
	for _, m := range []string{
		http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete,
		http.MethodPatch, http.MethodOptions, http.MethodHead, http.MethodConnect,
		http.MethodTrace,
	} {
		router.Handle(m, "/:p0/:p1/a/:p2", h)
		router.Handle(m, "/s/:p0/:p1/:p2/:p3/:p4/:p5/d", h)
	}
	router.GET("/only-get", h)
	w := acceptServe(t, router, http.MethodPost, "/only-get")
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
}
