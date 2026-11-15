// Copyright 2014 Manuel Martínez-Almeida. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package gin

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Acceptance, based on the regression test of gin-gonic/gin#4702 (issue #4622):
// saving an uploaded file into a directory that already exists leaves that
// directory's permissions as they were (changing them fails outright on a
// directory the process does not own, such as /tmp).
func TestAcceptUploadExistingDirUntouched(t *testing.T) {
	buf := new(bytes.Buffer)
	mw := multipart.NewWriter(buf)
	w, err := mw.CreateFormFile("file", "existing_dir_test")
	require.NoError(t, err)
	_, err = w.Write([]byte("existing_dir_test"))
	require.NoError(t, err)
	require.NoError(t, mw.Close())

	c, _ := CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/", buf)
	c.Request.Header.Set("Content-Type", mw.FormDataContentType())
	f, err := c.FormFile("file")
	require.NoError(t, err)

	dir := t.TempDir()
	require.NoError(t, os.Chmod(dir, 0o700))

	dst := filepath.Join(dir, "existing_dir_test.txt")
	require.NoError(t, c.SaveUploadedFile(f, dst, 0o755))

	info, err := os.Stat(dir)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o700), info.Mode().Perm(), "permissions of a pre-existing directory must not be modified")

	content, err := os.ReadFile(dst)
	require.NoError(t, err)
	assert.Equal(t, "existing_dir_test", string(content))
}

// A directory the call creates still gets the permissions asked for.
func TestAcceptUploadNewDirGetsPerm(t *testing.T) {
	buf := new(bytes.Buffer)
	mw := multipart.NewWriter(buf)
	w, err := mw.CreateFormFile("file", "new_dir_test")
	require.NoError(t, err)
	_, err = w.Write([]byte("new_dir_test"))
	require.NoError(t, err)
	require.NoError(t, mw.Close())

	c, _ := CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/", buf)
	c.Request.Header.Set("Content-Type", mw.FormDataContentType())
	f, err := c.FormFile("file")
	require.NoError(t, err)

	dir := filepath.Join(t.TempDir(), "fresh")
	require.NoError(t, c.SaveUploadedFile(f, filepath.Join(dir, "x.txt"), 0o755))
	info, err := os.Stat(dir)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o755), info.Mode().Perm())
}
