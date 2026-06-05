package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const defaultWorkspaceChatCategoryName = "general"
const defaultWorkspaceChatCategoryAlias = "常用"

type WorkspaceChatCategory struct {
	Id          int    `json:"id"`
	Weight      int    `json:"weight" gorm:"default:0;index"`
	Name        string `json:"name" gorm:"type:varchar(64);not null;uniqueIndex"`
	Alias       string `json:"alias" gorm:"type:varchar(128);default:''"`
	Remark      string `json:"remark" gorm:"type:varchar(255);default:''"`
	Disabled    bool   `json:"disabled" gorm:"default:false;index"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime int64  `json:"updated_time" gorm:"bigint"`
}

type WorkspaceChatChannel struct {
	Id                int    `json:"id"`
	Weight            int    `json:"weight" gorm:"default:0;index"`
	Model             string `json:"model" gorm:"type:varchar(255);not null;uniqueIndex"`
	ModelAlias        string `json:"model_alias" gorm:"type:varchar(255);default:''"`
	CategoryId        int    `json:"category_id" gorm:"index;not null"`
	VisionEnabled     bool   `json:"vision_enabled" gorm:"default:true"`
	FileUploadEnabled bool   `json:"file_upload_enabled" gorm:"default:true"`
	WebSearchEnabled  bool   `json:"web_search_enabled" gorm:"default:true"`
	Disabled          bool   `json:"disabled" gorm:"default:false;index"`
	Remark            string `json:"remark" gorm:"type:varchar(255);default:''"`
	CreatedTime       int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime       int64  `json:"updated_time" gorm:"bigint"`

	Category *WorkspaceChatCategory `json:"category,omitempty" gorm:"foreignKey:CategoryId"`
}

type WorkspaceChatModel struct {
	Id                int    `json:"id"`
	Model             string `json:"model"`
	ModelAlias        string `json:"model_alias"`
	DisplayName       string `json:"display_name"`
	CategoryId        int    `json:"category_id"`
	CategoryName      string `json:"category_name"`
	CategoryAlias     string `json:"category_alias"`
	CategoryDisplay   string `json:"category_display"`
	VisionEnabled     bool   `json:"vision_enabled"`
	FileUploadEnabled bool   `json:"file_upload_enabled"`
	WebSearchEnabled  bool   `json:"web_search_enabled"`
}

type WorkspaceChatSession struct {
	Id          int    `json:"id"`
	UserId      int    `json:"user_id" gorm:"index;not null"`
	Title       string `json:"title" gorm:"type:varchar(255);not null;default:'New chat'"`
	Model       string `json:"model" gorm:"type:varchar(255);default:''"`
	Archived    bool   `json:"archived" gorm:"default:false;index"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime int64  `json:"updated_time" gorm:"bigint;index"`
}

type WorkspaceChatMessage struct {
	Id          int    `json:"id"`
	SessionId   int    `json:"session_id" gorm:"index;not null"`
	UserId      int    `json:"user_id" gorm:"index;not null"`
	Role        string `json:"role" gorm:"type:varchar(32);not null"`
	Content     string `json:"content" gorm:"type:text"`
	Model       string `json:"model" gorm:"type:varchar(255);default:''"`
	Metadata    string `json:"metadata" gorm:"type:text"`
	CreatedTime int64  `json:"created_time" gorm:"bigint;index"`
	UpdatedTime int64  `json:"updated_time" gorm:"bigint"`
}

func EnsureDefaultWorkspaceChatCategory() (*WorkspaceChatCategory, error) {
	var category WorkspaceChatCategory
	err := DB.Where("name = ?", defaultWorkspaceChatCategoryName).First(&category).Error
	if err == nil {
		return &category, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	now := common.GetTimestamp()
	category = WorkspaceChatCategory{
		Weight:      100,
		Name:        defaultWorkspaceChatCategoryName,
		Alias:       defaultWorkspaceChatCategoryAlias,
		Disabled:    false,
		CreatedTime: now,
		UpdatedTime: now,
	}
	if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&category).Error; err != nil {
		return nil, err
	}
	if category.Id != 0 {
		return &category, nil
	}
	if err := DB.Where("name = ?", defaultWorkspaceChatCategoryName).First(&category).Error; err != nil {
		return nil, err
	}
	return &category, nil
}

func GetWorkspaceChatCategories() ([]WorkspaceChatCategory, error) {
	if _, err := EnsureDefaultWorkspaceChatCategory(); err != nil {
		return nil, err
	}
	var categories []WorkspaceChatCategory
	err := DB.Order("weight DESC").Order("id ASC").Find(&categories).Error
	return categories, err
}

func CreateWorkspaceChatCategory(category *WorkspaceChatCategory) error {
	now := common.GetTimestamp()
	category.Name = strings.TrimSpace(category.Name)
	category.Alias = strings.TrimSpace(category.Alias)
	category.Remark = strings.TrimSpace(category.Remark)
	category.CreatedTime = now
	category.UpdatedTime = now
	return DB.Create(category).Error
}

func UpdateWorkspaceChatCategory(category *WorkspaceChatCategory) error {
	category.Name = strings.TrimSpace(category.Name)
	category.Alias = strings.TrimSpace(category.Alias)
	category.Remark = strings.TrimSpace(category.Remark)
	category.UpdatedTime = common.GetTimestamp()
	return DB.Model(&WorkspaceChatCategory{}).Where("id = ?", category.Id).Updates(map[string]interface{}{
		"weight":       category.Weight,
		"name":         category.Name,
		"alias":        category.Alias,
		"remark":       category.Remark,
		"disabled":     category.Disabled,
		"updated_time": category.UpdatedTime,
	}).Error
}

func DeleteWorkspaceChatCategory(id int) error {
	var count int64
	if err := DB.Model(&WorkspaceChatCategory{}).Count(&count).Error; err != nil {
		return err
	}
	if count <= 1 {
		return errors.New("at least one category must remain")
	}
	var used int64
	if err := DB.Model(&WorkspaceChatChannel{}).Where("category_id = ?", id).Count(&used).Error; err != nil {
		return err
	}
	if used > 0 {
		return errors.New("category is used by channels")
	}
	return DB.Delete(&WorkspaceChatCategory{}, id).Error
}

func GetWorkspaceChatChannels() ([]WorkspaceChatChannel, error) {
	if _, err := EnsureDefaultWorkspaceChatCategory(); err != nil {
		return nil, err
	}
	var channels []WorkspaceChatChannel
	err := DB.Preload("Category").Order("weight DESC").Order("id ASC").Find(&channels).Error
	return channels, err
}

func CreateWorkspaceChatChannel(channel *WorkspaceChatChannel) error {
	now := common.GetTimestamp()
	channel.Model = strings.TrimSpace(channel.Model)
	channel.ModelAlias = strings.TrimSpace(channel.ModelAlias)
	channel.Remark = strings.TrimSpace(channel.Remark)
	channel.CreatedTime = now
	channel.UpdatedTime = now
	return DB.Create(channel).Error
}

func UpdateWorkspaceChatChannel(channel *WorkspaceChatChannel) error {
	channel.Model = strings.TrimSpace(channel.Model)
	channel.ModelAlias = strings.TrimSpace(channel.ModelAlias)
	channel.Remark = strings.TrimSpace(channel.Remark)
	channel.UpdatedTime = common.GetTimestamp()
	return DB.Model(&WorkspaceChatChannel{}).Where("id = ?", channel.Id).Updates(map[string]interface{}{
		"weight":              channel.Weight,
		"model":               channel.Model,
		"model_alias":         channel.ModelAlias,
		"category_id":         channel.CategoryId,
		"vision_enabled":      channel.VisionEnabled,
		"file_upload_enabled": channel.FileUploadEnabled,
		"web_search_enabled":  channel.WebSearchEnabled,
		"disabled":            channel.Disabled,
		"remark":              channel.Remark,
		"updated_time":        channel.UpdatedTime,
	}).Error
}

func DeleteWorkspaceChatChannel(id int) error {
	return DB.Delete(&WorkspaceChatChannel{}, id).Error
}

func GetWorkspaceChatModels() ([]WorkspaceChatModel, error) {
	if _, err := EnsureDefaultWorkspaceChatCategory(); err != nil {
		return nil, err
	}
	var channels []WorkspaceChatChannel
	err := DB.Preload("Category").
		Where("workspace_chat_channels.disabled = ?", false).
		Order("workspace_chat_channels.weight DESC").
		Order("workspace_chat_channels.id ASC").
		Find(&channels).Error
	if err != nil {
		return nil, err
	}
	models := make([]WorkspaceChatModel, 0, len(channels))
	for _, channel := range channels {
		if channel.Category != nil && channel.Category.Disabled {
			continue
		}
		displayName := channel.ModelAlias
		if displayName == "" {
			displayName = channel.Model
		}
		categoryName := ""
		categoryAlias := ""
		categoryDisplay := ""
		if channel.Category != nil {
			categoryName = channel.Category.Name
			categoryAlias = channel.Category.Alias
			categoryDisplay = categoryAlias
			if categoryDisplay == "" {
				categoryDisplay = categoryName
			}
		}
		models = append(models, WorkspaceChatModel{
			Id:                channel.Id,
			Model:             channel.Model,
			ModelAlias:        channel.ModelAlias,
			DisplayName:       displayName,
			CategoryId:        channel.CategoryId,
			CategoryName:      categoryName,
			CategoryAlias:     categoryAlias,
			CategoryDisplay:   categoryDisplay,
			VisionEnabled:     channel.VisionEnabled,
			FileUploadEnabled: channel.FileUploadEnabled,
			WebSearchEnabled:  channel.WebSearchEnabled,
		})
	}
	return models, nil
}

func GetWorkspaceChatAvailableModels() []string {
	pricing := GetPricing()
	seen := make(map[string]bool, len(pricing))
	models := make([]string, 0, len(pricing))
	for _, item := range pricing {
		modelName := strings.TrimSpace(item.ModelName)
		if modelName == "" || seen[modelName] {
			continue
		}
		seen[modelName] = true
		models = append(models, modelName)
	}
	return models
}

func CreateWorkspaceChatSession(session *WorkspaceChatSession) error {
	now := common.GetTimestamp()
	session.CreatedTime = now
	session.UpdatedTime = now
	if strings.TrimSpace(session.Title) == "" {
		session.Title = "New chat"
	}
	return DB.Create(session).Error
}

func GetWorkspaceChatSessions(userId int, archived bool) ([]WorkspaceChatSession, error) {
	var sessions []WorkspaceChatSession
	err := DB.Where("user_id = ? AND archived = ?", userId, archived).
		Order("updated_time DESC").
		Order("id DESC").
		Find(&sessions).Error
	return sessions, err
}

func GetWorkspaceChatSession(userId int, id int) (*WorkspaceChatSession, error) {
	var session WorkspaceChatSession
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&session).Error
	if err != nil {
		return nil, err
	}
	return &session, nil
}

func UpdateWorkspaceChatSession(session *WorkspaceChatSession) error {
	session.UpdatedTime = common.GetTimestamp()
	return DB.Model(&WorkspaceChatSession{}).
		Where("id = ? AND user_id = ?", session.Id, session.UserId).
		Updates(map[string]interface{}{
			"title":        strings.TrimSpace(session.Title),
			"model":        strings.TrimSpace(session.Model),
			"archived":     session.Archived,
			"updated_time": session.UpdatedTime,
		}).Error
}

func DeleteWorkspaceChatSession(userId int, id int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("session_id = ? AND user_id = ?", id, userId).Delete(&WorkspaceChatMessage{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ? AND user_id = ?", id, userId).Delete(&WorkspaceChatSession{}).Error
	})
}

func GetWorkspaceChatMessages(userId int, sessionId int) ([]WorkspaceChatMessage, error) {
	var messages []WorkspaceChatMessage
	err := DB.Where("user_id = ? AND session_id = ?", userId, sessionId).
		Order("created_time ASC").
		Order("id ASC").
		Find(&messages).Error
	return messages, err
}

func CreateWorkspaceChatMessage(message *WorkspaceChatMessage) error {
	now := common.GetTimestamp()
	message.CreatedTime = now
	message.UpdatedTime = now
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(message).Error; err != nil {
			return err
		}
		return tx.Model(&WorkspaceChatSession{}).
			Where("id = ? AND user_id = ?", message.SessionId, message.UserId).
			Updates(map[string]interface{}{
				"updated_time": now,
				"model":        message.Model,
			}).Error
	})
}

func UpdateWorkspaceChatSessionTitleIfDefault(userId int, sessionId int, title string) error {
	title = strings.TrimSpace(title)
	if title == "" {
		return nil
	}
	return DB.Model(&WorkspaceChatSession{}).
		Where("id = ? AND user_id = ? AND title = ?", sessionId, userId, "New chat").
		Updates(map[string]interface{}{
			"title":        title,
			"updated_time": common.GetTimestamp(),
		}).Error
}

func EnsureWorkspaceChatCategoryExists(categoryId int) error {
	var count int64
	if err := DB.Model(&WorkspaceChatCategory{}).Where("id = ?", categoryId).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return errors.New("category not found")
	}
	return nil
}

func EnsureWorkspaceChatModelAvailable(modelName string) error {
	var count int64
	err := DB.Table("abilities").
		Joins("left join channels on abilities.channel_id = channels.id").
		Where("abilities.model = ? AND abilities.enabled = ? AND channels.status = ?", modelName, true, common.ChannelStatusEnabled).
		Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return errors.New("model is not available")
	}
	return nil
}
