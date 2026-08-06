import { createSlice } from "@reduxjs/toolkit";

// Load initial sidebar state from localStorage
const getInitialSidebarState = () => {
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
  aiModalOpen: false,
  aiModalConversationId: null,
  feedbackModalOpen: false,
  sidebarCollapsed: getInitialSidebarState(),
};

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    showAiModal: (state, action) => {
      state.aiModalOpen = true;
      state.aiModalConversationId = action.payload?.conversationId || null;
    },
    hideAiModal: (state) => {
      state.aiModalOpen = false;
      state.aiModalConversationId = null;
    },
    toggleAiModal: (state) => {
      state.aiModalOpen = !state.aiModalOpen;
      if (!state.aiModalOpen) {
        state.aiModalConversationId = null;
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
export const selectAiModalConversationId = (state) => state.ui.aiModalConversationId;
export const selectFeedbackModalOpen = (state) => state.ui.feedbackModalOpen;
export const selectSidebarCollapsed = (state) => state.ui.sidebarCollapsed;

export default uiSlice.reducer;
