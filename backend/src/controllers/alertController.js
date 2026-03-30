exports.getAlerts = (_req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        alerts: [],
        summary: {
          total: 0,
          lowStock: 0,
          warranty: 0,
          critical: 0,
          warning: 0,
        },
      },
      message: 'No alerts available',
    });
  } catch (error) {
    console.error(`[ERROR] GET /api/alerts:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Error retrieving alerts',
      error: error.message,
    });
  }
};
