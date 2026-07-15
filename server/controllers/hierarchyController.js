import Region from '../models/Region.js';
import Zone from '../models/Zone.js';
import Circle from '../models/Circle.js';
import Ward from '../models/Ward.js';

export const getRegions = async (req, res, next) => {
  try {
    const regions = await Region.find({ status: 'active' }).sort({ name: 1 });
    res.json({ success: true, data: regions });
  } catch (err) {
    next(err);
  }
};

export const getZones = async (req, res, next) => {
  try {
    const zones = await Zone.find({ status: 'active' }).populate('region', 'name').sort({ zoneNo: 1 });
    res.json({ success: true, data: zones });
  } catch (err) {
    next(err);
  }
};

export const getCirclesByZone = async (req, res, next) => {
  try {
    const circles = await Circle.find({ zone: req.params.zoneId, status: 'active' }).sort({ circleNo: 1 });
    res.json({ success: true, data: circles });
  } catch (err) {
    next(err);
  }
};

export const getWardsByCircle = async (req, res, next) => {
  try {
    const wards = await Ward.find({ circle: req.params.circleId, status: 'active' }).sort({ wardNo: 1 });
    res.json({ success: true, data: wards });
  } catch (err) {
    next(err);
  }
};
