export const defaultProjectState = {
  setupData: null,
  scene: {
    placedAssets: [],
    selectedPlacedAssetKey: null,
    backdropState: null,
  },
  scriptsByInstanceKey: {},
};

export function normalizeProjectState(projectState) {
  return {
    setupData: projectState?.setupData || null,
    scene: {
      ...defaultProjectState.scene,
      ...(projectState?.scene || {}),
    },
    scriptsByInstanceKey: projectState?.scriptsByInstanceKey || {},
  };
}
