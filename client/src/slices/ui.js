import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  aiModalOpen: false,
};

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    showAiModal: (state) => {
      state.aiModalOpen = true;
    },
    hideAiModal: (state) => {
      state.aiModalOpen = false;
    },
    toggleAiModal: (state) => {
      state.aiModalOpen = !state.aiModalOpen;
    },
  },
});

export const { showAiModal, hideAiModal, toggleAiModal } = uiSlice.actions;

export const selectAiModalOpen = (state) => state.ui.aiModalOpen;

export default uiSlice.reducer;
