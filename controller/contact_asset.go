package controller

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

const (
	contactAssetRoot      = "data/contact-assets"
	contactAssetURLPrefix = "/api/contact-assets"
	contactAssetMaxBytes  = 5 << 20
)

var allowedContactAssetFields = map[string]bool{
	"wechat_qr_image":  true,
	"support_qr_image": true,
}

func randomContactAssetName() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return strings.ReplaceAll(time.Now().Format("20060102150405.000000000"), ".", "")
	}
	return hex.EncodeToString(b[:])
}

func contactAssetPath(relativePath string) (string, bool) {
	clean := filepath.Clean(strings.TrimLeft(relativePath, "/\\"))
	if clean == "." || strings.HasPrefix(clean, "..") || filepath.IsAbs(clean) {
		return "", false
	}
	root, err := filepath.Abs(contactAssetRoot)
	if err != nil {
		return "", false
	}
	target, err := filepath.Abs(filepath.Join(root, clean))
	if err != nil {
		return "", false
	}
	rel, err := filepath.Rel(root, target)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", false
	}
	return target, true
}

func contactAssetExtension(contentType string) string {
	exts, err := mime.ExtensionsByType(contentType)
	if err == nil && len(exts) > 0 {
		return exts[0]
	}
	switch contentType {
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	default:
		return ".bin"
	}
}

func UploadContactAsset(c *gin.Context) {
	field := strings.TrimSpace(c.PostForm("field"))
	if !allowedContactAssetFields[field] {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid contact image field",
		})
		return
	}
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "image file is required",
		})
		return
	}
	defer file.Close()
	if header.Size > contactAssetMaxBytes {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "image file is too large",
		})
		return
	}
	limited := io.LimitReader(file, contactAssetMaxBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(data) == 0 || len(data) > contactAssetMaxBytes {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "image file is too large",
		})
		return
	}
	contentType := http.DetectContentType(data)
	if !strings.HasPrefix(contentType, "image/") {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "only image files are allowed",
		})
		return
	}
	ext := contactAssetExtension(contentType)
	relativePath := filepath.ToSlash(filepath.Join(field, randomContactAssetName()+ext))
	targetPath, ok := contactAssetPath(relativePath)
	if !ok {
		common.ApiError(c, errors.New("invalid upload path"))
		return
	}
	if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := os.WriteFile(targetPath, data, 0644); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"url": contactAssetURLPrefix + "/" + relativePath,
	})
}

func GetContactAsset(c *gin.Context) {
	path, ok := contactAssetPath(strings.TrimPrefix(c.Param("path"), "/"))
	if !ok {
		c.Status(http.StatusNotFound)
		return
	}
	c.File(path)
}
