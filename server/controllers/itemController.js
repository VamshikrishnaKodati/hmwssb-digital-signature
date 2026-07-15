import Item from '../models/Item.js';
import AuditLog from '../models/AuditLog.js';
import { success, created, notFound, conflict, paginated } from '../utils/apiResponse.js';
import { escapeRegex } from '../utils/sanitize.js';
import logger from '../utils/logger.js';

export const searchItems = async (req, res, next) => {
  try {
    const { q, category } = req.query;
    const filter = { status: 'active' };
    if (q) {
      const safe = escapeRegex(q);
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { itemCode: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
      ];
    }
    if (category) filter.category = category;
    const items = await Item.find(filter).limit(50).sort({ name: 1 }).lean();
    return success(res, { data: { items } });
  } catch (err) {
    next(err);
  }
};

export const getAllItems = async (req, res, next) => {
  try {
    const { category, status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;

    const items = await Item.find(filter)
      .sort({ name: 1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    const total = await Item.countDocuments(filter);

    return paginated(res, { data: items, total, page, limit });
  } catch (err) {
    next(err);
  }
};

export const getItemById = async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id).lean();
    if (!item) return notFound(res, 'Item not found');
    return success(res, { data: { item } });
  } catch (err) {
    next(err);
  }
};

export const createItem = async (req, res, next) => {
  try {
    const itemData = { ...req.body };
    if (req.user) itemData.createdBy = req.user.id;
    const item = await Item.create(itemData);

    await AuditLog.create({
      userId: req.user?.id,
      actorName: req.user?.name,
      actorRole: req.user?.role,
      action: 'ITEM_CREATED',
      entity: 'Item',
      entityId: item._id.toString(),
      module: 'Item Master',
      description: `Created item ${item.name} (${item.itemCode})`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: { itemCode: item.itemCode, name: item.name, category: item.category },
    });

    return created(res, { data: { item }, message: 'Item created successfully' });
  } catch (err) {
    if (err.code === 11000) {
      return conflict(res, 'Item code already exists');
    }
    next(err);
  }
};

export const updateItem = async (req, res, next) => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return notFound(res, 'Item not found');

    await AuditLog.create({
      userId: req.user?.id,
      actorName: req.user?.name,
      actorRole: req.user?.role,
      action: 'ITEM_UPDATED',
      entity: 'Item',
      entityId: item._id.toString(),
      module: 'Item Master',
      description: `Updated item ${item.name}`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: { itemId: item._id, updates: Object.keys(req.body) },
    });

    return success(res, { data: { item }, message: 'Item updated successfully' });
  } catch (err) {
    if (err.code === 11000) {
      return conflict(res, 'Item code already exists');
    }
    next(err);
  }
};

export const deleteItem = async (req, res, next) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return notFound(res, 'Item not found');

    await AuditLog.create({
      userId: req.user?.id,
      actorName: req.user?.name,
      actorRole: req.user?.role,
      action: 'ITEM_DELETED',
      entity: 'Item',
      entityId: req.params.id,
      module: 'Item Master',
      description: `Deleted item ${item.name}`,
      ip: req.ip,
    });

    return success(res, { message: 'Item deleted successfully' });
  } catch (err) {
    next(err);
  }
};

export const seedItems = async () => {
  const count = await Item.countDocuments();
  if (count > 0) return;

  const items = [
    { itemCode: 'MAT-001', name: 'Cement Bag', unit: 'Bag', rate: 420, category: 'Material', gst: 18, description: 'OPC 53 Grade Cement' },
    { itemCode: 'MAT-002', name: 'GI Pipe 20mm', unit: 'Meter', rate: 180, category: 'Material', gst: 18, description: 'Galvanized Iron Pipe 20mm dia' },
    { itemCode: 'MAT-003', name: 'GI Pipe 25mm', unit: 'Meter', rate: 220, category: 'Material', gst: 18, description: 'Galvanized Iron Pipe 25mm dia' },
    { itemCode: 'MAT-004', name: 'GI Pipe 32mm', unit: 'Meter', rate: 280, category: 'Material', gst: 18, description: 'Galvanized Iron Pipe 32mm dia' },
    { itemCode: 'MAT-005', name: 'Brick', unit: 'Nos', rate: 10, category: 'Material', gst: 5, description: 'Standard Burnt Brick' },
    { itemCode: 'MAT-006', name: 'Sand', unit: 'CUM', rate: 1600, category: 'Material', gst: 5, description: 'River Sand' },
    { itemCode: 'MAT-007', name: 'Steel Rod 8mm', unit: 'Kg', rate: 85, category: 'Material', gst: 18, description: 'Fe-500 TMT Bar' },
    { itemCode: 'MAT-008', name: 'Steel Rod 10mm', unit: 'Kg', rate: 90, category: 'Material', gst: 18, description: 'Fe-500 TMT Bar' },
    { itemCode: 'MAT-009', name: 'Steel Rod 12mm', unit: 'Kg', rate: 95, category: 'Material', gst: 18, description: 'Fe-500 TMT Bar' },
    { itemCode: 'MAT-010', name: 'Steel Rod 16mm', unit: 'Kg', rate: 100, category: 'Material', gst: 18, description: 'Fe-500 TMT Bar' },
    { itemCode: 'MAT-011', name: 'Aggregate 20mm', unit: 'CUM', rate: 1200, category: 'Material', gst: 5, description: 'Coarse Aggregate 20mm' },
    { itemCode: 'MAT-012', name: 'Aggregate 10mm', unit: 'CUM', rate: 1100, category: 'Material', gst: 5, description: 'Coarse Aggregate 10mm' },
    { itemCode: 'MAT-013', name: 'Binding Wire', unit: 'Kg', rate: 120, category: 'Material', gst: 18, description: 'Annealed Binding Wire' },
    { itemCode: 'MAT-014', name: 'Shuttering Plywood', unit: 'SQM', rate: 350, category: 'Material', gst: 18, description: '12mm Thick Plywood' },
    { itemCode: 'MAT-015', name: 'Barbed Wire Fencing', unit: 'Meter', rate: 150, category: 'Material', gst: 18, description: '4 Strand Barbed Wire' },
    { itemCode: 'MAT-016', name: 'PVC Pipe 110mm', unit: 'Meter', rate: 320, category: 'Material', gst: 18, description: 'Schedule 40 PVC Pipe' },
    { itemCode: 'CIV-001', name: 'Excavation', unit: 'CUM', rate: 320, category: 'Civil', gst: 0, description: 'Earthwork Excavation in All Soils' },
    { itemCode: 'CIV-002', name: 'PCC 1:4:8', unit: 'CUM', rate: 4500, category: 'Civil', gst: 5, description: 'Plain Cement Concrete 1:4:8' },
    { itemCode: 'CIV-003', name: 'RCC 1:1.5:3', unit: 'CUM', rate: 6800, category: 'Civil', gst: 5, description: 'Reinforced Cement Concrete 1:1.5:3' },
    { itemCode: 'CIV-004', name: 'Plastering', unit: 'SQM', rate: 280, category: 'Civil', gst: 5, description: '12mm Thick Cement Plaster' },
    { itemCode: 'CIV-005', name: 'Brickwork', unit: 'CUM', rate: 4200, category: 'Civil', gst: 5, description: 'Brickwork in CM 1:6' },
    { itemCode: 'CIV-006', name: 'Flooring', unit: 'SQM', rate: 650, category: 'Civil', gst: 5, description: 'Vitrified Tile Flooring 600x600mm' },
    { itemCode: 'CIV-007', name: 'Painting', unit: 'SQM', rate: 85, category: 'Civil', gst: 18, description: 'Weatherproof Exterior Paint' },
    { itemCode: 'CIV-008', name: 'Waterproofing', unit: 'SQM', rate: 420, category: 'Civil', gst: 5, description: 'Brickbat Coba Waterproofing' },
    { itemCode: 'CIV-009', name: 'Earthwork Filling', unit: 'CUM', rate: 250, category: 'Civil', gst: 0, description: 'Filling with Available Earth' },
  ];

  await Item.insertMany(items);
  logger.info('Seed', `Seeded ${items.length} items`);
};
