const db = require('../config/db');

exports.getNotifications = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT n.*, eh."WorkID"
       FROM "Notification" n
       LEFT JOIN "EstimateHeader" eh ON eh."EstimateID" = n."EstimateID"
       WHERE n."ToUserID" = $1
       ORDER BY n."CreatedDate" DESC
       LIMIT 50`,
      [req.user.UserID]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query(
      'UPDATE "Notification" SET "IsRead" = TRUE WHERE "NotificationID" = $1 AND "ToUserID" = $2',
      [id, req.user.UserID]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE "Notification" SET "IsRead" = TRUE WHERE "ToUserID" = $1',
      [req.user.UserID]
    );
    res.json({ message: 'All marked as read' });
  } catch (err) {
    next(err);
  }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM "Notification" WHERE "ToUserID" = $1 AND "IsRead" = FALSE',
      [req.user.UserID]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    next(err);
  }
};
