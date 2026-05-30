package controller

import (
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const workspaceChatDefaultTitle = "New chat"

type workspaceChatMessageRequest struct {
	Role     string         `json:"role"`
	Content  string         `json:"content"`
	Model    string         `json:"model"`
	Metadata map[string]any `json:"metadata"`
}

type workspaceChatSessionRequest struct {
	Title    string `json:"title"`
	Model    string `json:"model"`
	Archived *bool  `json:"archived"`
}

func parseWorkspaceID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid id")
		return 0, false
	}
	return id, true
}

func truncateWorkspaceChatTitle(content string) string {
	content = strings.Join(strings.Fields(strings.TrimSpace(content)), " ")
	if content == "" {
		return workspaceChatDefaultTitle
	}
	const maxRunes = 36
	if utf8.RuneCountInString(content) <= maxRunes {
		return content
	}
	runes := []rune(content)
	return string(runes[:maxRunes]) + "..."
}

func AdminListWorkspaceChatCategories(c *gin.Context) {
	categories, err := model.GetWorkspaceChatCategories()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, categories)
}

func AdminCreateWorkspaceChatCategory(c *gin.Context) {
	var category model.WorkspaceChatCategory
	if err := c.ShouldBindJSON(&category); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(category.Name) == "" {
		common.ApiErrorMsg(c, "category is required")
		return
	}
	if err := model.CreateWorkspaceChatCategory(&category); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, category)
}

func AdminUpdateWorkspaceChatCategory(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	var category model.WorkspaceChatCategory
	if err := c.ShouldBindJSON(&category); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(category.Name) == "" {
		common.ApiErrorMsg(c, "category is required")
		return
	}
	category.Id = id
	if err := model.UpdateWorkspaceChatCategory(&category); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, category)
}

func AdminDeleteWorkspaceChatCategory(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	if err := model.DeleteWorkspaceChatCategory(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminListWorkspaceChatChannels(c *gin.Context) {
	channels, err := model.GetWorkspaceChatChannels()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, channels)
}

func AdminCreateWorkspaceChatChannel(c *gin.Context) {
	var channel model.WorkspaceChatChannel
	if err := c.ShouldBindJSON(&channel); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(channel.Model) == "" {
		common.ApiErrorMsg(c, "model is required")
		return
	}
	if err := model.EnsureWorkspaceChatCategoryExists(channel.CategoryId); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.EnsureWorkspaceChatModelAvailable(channel.Model); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.CreateWorkspaceChatChannel(&channel); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, channel)
}

func AdminUpdateWorkspaceChatChannel(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	var channel model.WorkspaceChatChannel
	if err := c.ShouldBindJSON(&channel); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(channel.Model) == "" {
		common.ApiErrorMsg(c, "model is required")
		return
	}
	if err := model.EnsureWorkspaceChatCategoryExists(channel.CategoryId); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.EnsureWorkspaceChatModelAvailable(channel.Model); err != nil {
		common.ApiError(c, err)
		return
	}
	channel.Id = id
	if err := model.UpdateWorkspaceChatChannel(&channel); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, channel)
}

func AdminDeleteWorkspaceChatChannel(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	if err := model.DeleteWorkspaceChatChannel(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminWorkspaceChatAvailableModels(c *gin.Context) {
	common.ApiSuccess(c, model.GetWorkspaceChatAvailableModels())
}

func GetWorkspaceChatModels(c *gin.Context) {
	models, err := model.GetWorkspaceChatModels()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, models)
}

func ListWorkspaceChatSessions(c *gin.Context) {
	archived := c.Query("archived") == "true"
	sessions, err := model.GetWorkspaceChatSessions(c.GetInt("id"), archived)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, sessions)
}

func CreateWorkspaceChatSession(c *gin.Context) {
	var req workspaceChatSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	archived := false
	if req.Archived != nil {
		archived = *req.Archived
	}
	session := model.WorkspaceChatSession{
		UserId:   c.GetInt("id"),
		Title:    strings.TrimSpace(req.Title),
		Model:    strings.TrimSpace(req.Model),
		Archived: archived,
	}
	if err := model.CreateWorkspaceChatSession(&session); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, session)
}

func UpdateWorkspaceChatSession(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	session, err := model.GetWorkspaceChatSession(c.GetInt("id"), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req workspaceChatSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(req.Title) != "" {
		session.Title = strings.TrimSpace(req.Title)
	}
	if req.Model != "" {
		session.Model = strings.TrimSpace(req.Model)
	}
	if req.Archived != nil {
		session.Archived = *req.Archived
	}
	if err := model.UpdateWorkspaceChatSession(session); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, session)
}

func DeleteWorkspaceChatSession(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	if err := model.DeleteWorkspaceChatSession(c.GetInt("id"), id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func ArchiveWorkspaceChatSession(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	session, err := model.GetWorkspaceChatSession(c.GetInt("id"), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	session.Archived = true
	if err := model.UpdateWorkspaceChatSession(session); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, session)
}

func UnarchiveWorkspaceChatSession(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	session, err := model.GetWorkspaceChatSession(c.GetInt("id"), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	session.Archived = false
	if err := model.UpdateWorkspaceChatSession(session); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, session)
}

func ListWorkspaceChatMessages(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	if _, err := model.GetWorkspaceChatSession(c.GetInt("id"), id); err != nil {
		common.ApiError(c, err)
		return
	}
	messages, err := model.GetWorkspaceChatMessages(c.GetInt("id"), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, messages)
}

func CreateWorkspaceChatMessage(c *gin.Context) {
	id, ok := parseWorkspaceID(c)
	if !ok {
		return
	}
	userId := c.GetInt("id")
	if _, err := model.GetWorkspaceChatSession(userId, id); err != nil {
		common.ApiError(c, err)
		return
	}
	var req workspaceChatMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	role := strings.TrimSpace(req.Role)
	if role == "" {
		common.ApiErrorMsg(c, "role is required")
		return
	}
	metadata := "{}"
	if req.Metadata != nil {
		data, err := common.Marshal(req.Metadata)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		metadata = string(data)
	}
	message := model.WorkspaceChatMessage{
		SessionId: id,
		UserId:    userId,
		Role:      role,
		Content:   req.Content,
		Model:     strings.TrimSpace(req.Model),
		Metadata:  metadata,
	}
	if err := model.CreateWorkspaceChatMessage(&message); err != nil {
		common.ApiError(c, err)
		return
	}
	if role == "user" {
		_ = model.UpdateWorkspaceChatSessionTitleIfDefault(userId, id, truncateWorkspaceChatTitle(req.Content))
	}
	common.ApiSuccess(c, message)
}
