export const defaultProjectState = {
  setupData: null,
  plan: null,
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
    plan: projectState?.plan || projectState?.setupData?.plan || null,
    scene: {
      ...defaultProjectState.scene,
      ...(projectState?.scene || {}),
    },
    scriptsByInstanceKey: projectState?.scriptsByInstanceKey || {},
  };
}
