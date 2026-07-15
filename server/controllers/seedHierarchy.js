import Region from '../models/Region.js';
import Zone from '../models/Zone.js';
import Circle from '../models/Circle.js';
import Ward from '../models/Ward.js';
import { hierarchyData } from '../seeders/hierarchyData.js';
import logger from '../utils/logger.js';

export const seedHierarchy = async () => {
  try {
    const existingRegion = await Region.findOne({ code: hierarchyData.region.code });
    if (existingRegion) {
      logger.info('Seed', 'Hierarchy already seeded, skipping');
      return;
    }

    const region = await Region.create(hierarchyData.region);
    logger.info('Seed', `Created region: ${region.name}`);

    for (const z of hierarchyData.zones) {
      const zone = await Zone.create({ name: z.name, zoneNo: z.zoneNo, region: region._id });
      logger.info('Seed', `  Created zone: ${zone.name}`);

      const zoneCircles = hierarchyData.circles.filter(c => c.zone === z.name);
      for (const c of zoneCircles) {
        const circle = await Circle.create({ circleNo: c.circleNo, name: c.name, zone: zone._id });
        logger.info('Seed', `    Created circle: ${circle.name}`);

        const circleWards = hierarchyData.wards.filter(w => w.circleNo === c.circleNo);
        const wardDocs = circleWards.map(w => ({
          wardNo: w.wardNo,
          name: w.name,
          circle: circle._id,
        }));
        if (wardDocs.length > 0) {
          await Ward.insertMany(wardDocs);
          logger.info('Seed', `      Created ${wardDocs.length} wards`);
        }
      }
    }

    logger.info('Seed', 'Hierarchy seeding completed successfully');
  } catch (err) {
    logger.error('Seed', `Hierarchy seed error: ${err.message}`);
  }
};
