package controller

import (
	"io"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newWorkspaceVideoTestContext(t *testing.T, body string) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	storage, err := common.CreateBodyStorage([]byte(body))
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = storage.Close()
	})
	c.Set(common.KeyBodyStorage, storage)
	c.Request = httptest.NewRequest("POST", "/api/workspace/video/generations", io.NopCloser(storage))
	return c
}

func TestApplyWorkspaceVideoMappedFieldsTypeControl(t *testing.T) {
	rawRequest := `{"model":"veo3","prompt":"walk","type":9,"metadata":{"type":8,"upstream_type":7}}`
	baseRequest := relaycommon.TaskSubmitReq{
		Model:  "veo3",
		Prompt: "walk",
		Type:   float64(9),
		Metadata: map[string]interface{}{
			"type":          float64(8),
			"upstream_type": float64(7),
		},
	}

	t.Run("disabled clears client type and mapped type", func(t *testing.T) {
		request := baseRequest
		channel := &model.WorkspaceVideoModel{
			FeatureControls: model.WorkspaceVideoFeatureControls{
				TypeControl: false,
				TypeValue:   `3`,
			},
			FieldMappings: model.WorkspaceVideoFieldMappings{
				Type: "upstream_type",
			},
		}
		c := newWorkspaceVideoTestContext(t, rawRequest)

		require.NoError(t, applyWorkspaceVideoMappedFields(c, &request, rawRequest, channel))
		require.Nil(t, request.Type)
		require.NotContains(t, request.Metadata, "type")
		require.NotContains(t, request.Metadata, "upstream_type")
	})

	t.Run("enabled sends preset value through mapped field", func(t *testing.T) {
		request := baseRequest
		channel := &model.WorkspaceVideoModel{
			FeatureControls: model.WorkspaceVideoFeatureControls{
				TypeControl: true,
				TypeValue:   `3`,
			},
			FieldMappings: model.WorkspaceVideoFieldMappings{
				Type: "upstream_type",
			},
		}
		c := newWorkspaceVideoTestContext(t, rawRequest)

		require.NoError(t, applyWorkspaceVideoMappedFields(c, &request, rawRequest, channel))
		require.Nil(t, request.Type)
		require.NotContains(t, request.Metadata, "type")
		require.Equal(t, float64(3), request.Metadata["upstream_type"])
	})
}
