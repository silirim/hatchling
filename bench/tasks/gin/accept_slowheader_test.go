// Copyright 2014 Manuel Martínez-Almeida. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package gin

import (
	"errors"
	"net"
	"testing"
	"time"
)

// Acceptance, for gin-gonic/gin#4800 (issue #4760): the server started by Run
// and RunListener does not keep forever a connection whose request headers
// never finish (slowloris). Any limit up to a minute is accepted.
const acceptSlowLimit = 65 * time.Second

func acceptSlowClient(t *testing.T, addr string) {
	t.Helper()
	var conn net.Conn
	var err error
	for i := 0; i < 50; i++ { // Run starts listening in its own goroutine
		if conn, err = net.Dial("tcp", addr); err == nil {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	if err != nil {
		t.Fatalf("dial %s: %v", addr, err)
	}
	defer conn.Close()
	if _, err := conn.Write([]byte("GET / HTTP/1.1\r\nHost: localhost\r\nX-Slow: 1\r\n")); err != nil {
		t.Fatal(err)
	}
	start := time.Now()
	_ = conn.SetReadDeadline(start.Add(acceptSlowLimit))
	buf := make([]byte, 512)
	for {
		if _, err := conn.Read(buf); err != nil {
			var ne net.Error
			if errors.As(err, &ne) && ne.Timeout() {
				t.Fatalf("the server kept a connection with unfinished headers open for %v", time.Since(start).Round(time.Second))
			}
			return // closed by the server
		}
	}
}

func TestAcceptSlowHeader(t *testing.T) {
	t.Run("RunListener", func(t *testing.T) {
		t.Parallel()
		ln, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { ln.Close() })
		router := New()
		go func() { _ = router.RunListener(ln) }()
		acceptSlowClient(t, ln.Addr().String())
	})
	t.Run("Run", func(t *testing.T) {
		t.Parallel()
		ln, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			t.Fatal(err)
		}
		addr := ln.Addr().String()
		ln.Close()
		router := New()
		go func() { _ = router.Run(addr) }()
		acceptSlowClient(t, addr)
	})
}
