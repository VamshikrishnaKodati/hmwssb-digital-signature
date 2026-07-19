import Notification from '../models/Notification.js';
import { success, notFound, paginated } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

export const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const filter = { userId: req.user.id };
    if (unreadOnly === 'true') filter.read = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.getUnreadCount(req.user.id);

    return success(res, {
      data: { notifications, unreadCount },
      meta: { total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) return notFound(res, 'Notification not found');
    return success(res, { message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    await Notification.markAllRead(req.user.id);
    return success(res, { message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!notification) return notFound(res, 'Notification not found');
    return success(res, { message: 'Notification deleted' });
  } catch (err) {
    next(err);
  }
};

export const sendNotification = async ({ userId, title, message, type, link, metadata }) => {
  try {
    return await Notification.send({ userId, title, message, type, link, metadata });
  } catch (err) {
    logger.error('Notification', 'Failed to send notification', { error: err.message, userId });
    return null;
  }
};
