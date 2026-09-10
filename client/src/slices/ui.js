import { createSlice } from "@reduxjs/toolkit";

// Load initial sidebar state from localStorage
const getInitialSidebarState = () => {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem("_cb_sidebar_state");
    if (stored !== null) {
      return stored === "true";
    }
  } catch (error) {
    console.error("Error reading sidebar state from localStorage:", error);
  }
  return false; // Default to expanded (not collapsed)
};

const initialState = {
  activeAiConversation: null,
  inlineAiConversationKey: null,
  aiModalOpen: false,
  aiModalConversationId: null,
  feedbackModalOpen: false,
  sidebarCollapsed: getInitialSidebarState(),
};

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setActiveAiConversation: (state, action) => {
      state.activeAiConversation = action.payload;
    },
    updateActiveAiConversation: (state, action) => {
      if (state.activeAiConversation?.key !== action.payload.key) return;
      Object.assign(state.activeAiConversation, action.payload);
    },
    dismissAiConversation: (state, action) => {
      if (!action.payload || state.activeAiConversation?.key === action.payload) {
        state.activeAiConversation = null;
      }
    },
    setInlineAiConversationKey: (state, action) => {
      state.inlineAiConversationKey = action.payload;
    },
    clearInlineAiConversationKey: (state, action) => {
      if (state.inlineAiConversationKey === action.payload) state.inlineAiConversationKey = null;
    },
    showAiModal: (state, action) => {
      state.aiModalOpen = true;
      state.aiModalConversationId = action.payload?.conversationId || state.activeAiConversation?.id || null;
    },
    hideAiModal: (state) => {
      state.aiModalOpen = false;
      state.aiModalConversationId = null;
    },
    toggleAiModal: (state) => {
      state.aiModalOpen = !state.aiModalOpen;
      if (!state.aiModalOpen) {
        state.aiModalConversationId = null;
      } else {
        state.aiModalConversationId = state.activeAiConversation?.id || null;
      }
    },
    clearAiModalConversationId: (state) => {
      state.aiModalConversationId = null;
    },
    showFeedbackModal: (state) => {
      state.feedbackModalOpen = true;
    },
    hideFeedbackModal: (state) => {
      state.feedbackModalOpen = false;
    },
    toggleFeedbackModal: (state) => {
      state.feedbackModalOpen = !state.feedbackModalOpen;
    },
    setSidebarCollapsed: (state, action) => {
      state.sidebarCollapsed = action.payload;
      try {
        window.localStorage.setItem("_cb_sidebar_state", String(action.payload));
      } catch (error) {
        console.error("Error saving sidebar state to localStorage:", error);
      }
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      try {
        window.localStorage.setItem("_cb_sidebar_state", String(state.sidebarCollapsed));
      } catch (error) {
        console.error("Error saving sidebar state to localStorage:", error);
      }
    },
  },
});

export const {
  setActiveAiConversation,
  updateActiveAiConversation,
  dismissAiConversation,
  setInlineAiConversationKey,
  clearInlineAiConversationKey,
  showAiModal,
  hideAiModal,
  toggleAiModal,
  clearAiModalConversationId,
  showFeedbackModal,
  hideFeedbackModal,
  toggleFeedbackModal,
  setSidebarCollapsed,
  toggleSidebar,
} = uiSlice.actions;

export const selectAiModalOpen = (state) => state.ui.aiModalOpen;
export const selectActiveAiConversation = (state) => state.ui.activeAiConversation;
export const selectInlineAiConversationKey = (state) => state.ui.inlineAiConversationKey;
export const selectAiModalConversationId = (state) => state.ui.aiModalConversationId;
export const selectFeedbackModalOpen = (state) => state.ui.feedbackModalOpen;
export const selectSidebarCollapsed = (state) => state.ui.sidebarCollapsed;

export default uiSlice.reducer;
