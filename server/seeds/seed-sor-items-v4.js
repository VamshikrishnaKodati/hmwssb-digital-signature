require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../config/db');

const ITEMS = [
  // Earthwork
  ['EXC-HW-001', 'Earthwork excavation in all types of soils for pipeline trenches incl. backfilling, disposal up to 50m, utility protection - Rate A', 'CUM', 'LxBxD', 523.7, 'Civil', false],
  ['EXC-HW-002', 'Earthwork excavation in all types of soils for pipeline trenches incl. backfilling, disposal up to 50m, utility protection - Rate B', 'CUM', 'LxBxD', 230.6, 'Civil', false],
  ['EXC-HW-003', 'Excavation in Hard rocky soils by Machine requiring controlled blasting for GLSR/pipeline trenches', 'CUM', 'LxBxD', 1287, 'Civil', false],
  ['EXC-HW-004', 'Excavation in Hard rock (blasting prohibited) with benching, chiselling for pipeline trenches/foundations', 'CUM', 'LxBxD', 3661, 'Civil', false],
  // Plastering
  ['PLSTR-HW-001', 'Plastering 12mm thick single coat CM 1:4 finished smooth incl. cutting grooves (per 10 Sqm)', '10 SQM', 'N', 28506, 'Civil', false],
  // Manholes
  ['MH-HW-001', 'Removing & Raising of RCC precast manhole chamber with CC 1:4:8 and 1:2:4 benching excluding chamber and frame', 'CUM', 'LxBxD', 6413, 'Civil', false],
  ['MH-HW-002', 'Supply, delivery and fixing of RCC precast manhole chamber 36"-21" tapering with FRC cover HD-20 and frame incl. CC M30/1:2:4', 'CUM', 'LxBxD', 6810.1, 'Civil', false],
  // Conveyance
  ['CONV-HW-001', 'Conveyance of stone ware pipes from HMWSSB stores to site up to 300mm dia incl. loading, stacking', 'CUM', 'N', 341, 'Civil', false],
  // Supply Materials
  ['SUP-HW-001', 'Supply and delivery of Pig Lead 99.99% pure', 'KG', 'N', 330, 'Material', true],
  ['SUP-HW-002', 'Supply and delivery of Spun Yarn best quality', 'KG', 'N', 130, 'Material', true],
  // PPC Connections
  ['PPC-HW-001', 'Redoing of PPC Connections for domestic water supply - MDPE 1/2" PPC Connection', 'Nos', 'N', 263.7, 'Civil', false],
  ['PPC-HW-002', 'Redoing of PPC Connections for domestic water supply - MDPE 3/4" PPC Connection', 'Nos', 'N', 275.3, 'Civil', false],
  // Drilling & Tapping
  ['DRL-HW-001', 'Drilling and tapping CI/DI main and fixing brass screw down ferrule and CI mouth cover (labour only) incl. shoring', 'CUM', 'N', 313.2, 'Civil', false],
  // Painting
  ['PAINT-HW-001', 'Painting walls with Snowcem/approved water proof cement paint two coats over prime coat (per 10 sqm)', '10 SQM', 'N', 2960.23, 'Civil', false],
  ['PAINT-HW-002', 'White washing one coat with whiting of approved quality (per 10 sqm)', '10 SQM', 'N', 362, 'Civil', false],
  ['PAINT-HW-003', 'Painting new walls with 2 coats ready mixed oil bound washable distemper over primer coat (per 10 sqm)', '10 SQM', 'N', 1784.86, 'Civil', false],
  // CI Steps
  ['CI-HW-001', 'Supplying & fixing CI steps for septic tank TBSP-B.II-11', 'Nos', 'N', 84, 'Civil', false],
  ['CI-HW-002', 'Supply and fixing of encapsulated plastic steps for manholes', 'Cum', 'N', 215.7, 'Civil', false],
  // Road Cutting
  ['RDCUT-HW-001', 'Cutting open BT road surface for pipeline trenches', 'CUM', 'LxBxD', 1441.68, 'Civil', false],
  ['RDCUT-HW-002', 'Cutting open CC road surface for pipeline trenches', 'CUM', 'LxBxD', 2998.7, 'Civil', false],
  ['RDCUT-HW-003', 'Cutting open WBM/WMM road surface for pipeline trenches', 'CUM', 'LxBxD', 368.57, 'Civil', false],
  // Barricading
  ['BARR-HW-001', 'Barricading, hoarding, lighting and watching for water supply/sewerage works for trenches up to 2m depth', 'RMT', 'L', 245.1, 'Civil', false],
  // Filling
  ['FILL-HW-001', 'Supply and filling with carted gravel in pipe line trenches incl. watering, ramming', 'CUM', 'LxBxD', 738.06, 'Civil', false],
  ['FILL-HW-002', 'Carting surplus excavated earth/rock from site up to 8 kms incl. loading, unloading, dumping', 'CUM', 'LxBxD', 192.14, 'Civil', false],
  ['FILL-HW-003', 'Supply and filling of crushed stone sand/rock sand 4.75mm to 2.36mm in trenches incl. watering, ramming', 'CUM', 'LxBxD', 665.5, 'Civil', false],
  // Drilling & Tapping sizes
  ['DRL-HW-002', 'Drilling and tapping 15mm CI/DI main and fixing brass ferrule and CI mouth cover (labour only)', 'Nos', 'N', 139.3, 'Civil', false],
  ['DRL-HW-003', 'Drilling and tapping 20mm CI/DI main and fixing brass ferrule and CI mouth cover (labour only)', 'Nos', 'N', 160.8, 'Civil', false],
  // CI Fittings supply
  ['SUP-HW-003', 'Manufacture, supply and delivery of CI fittings (spls.) conforming to IS 7181/1986, 5531/1988, 3950/1979', 'KG', 'N', 77.67, 'Material', false],
  ['SUP-HW-004', 'Making dummy arrangement to 100mm dia CI with CI socket tail piece, MS dummy plate, pig lead, spun yarn', 'Nos', 'N', 3575.85, 'Civil', false],
  ['SUP-HW-005', 'Making dummy arrangement to 150mm dia CI with CI socket tail piece, MS dummy plate, pig lead, spun yarn', 'Nos', 'N', 6051.85, 'Civil', false],
  // Manhole Covers
  ['MC-HW-001', 'Manufacture as per BIS:12592 supply & delivery of manhole covers and frames with ISI marking', 'Nos', 'N', 8565.7, 'Material', false],
  ['FILL-HW-004', 'Re-filling with excavated earth in pipe line trenches incl. watering, ramming in layers', 'CUM', 'LxBxD', 277.2, 'Civil', false],
  ['MC-HW-002', 'Manufacture as per BIS:12592 supply & delivery of manhole cover and frame MD10-500', 'Nos', 'N', 2428.54, 'Material', true],
  ['MC-HW-003', 'Manufacture as per BIS:12592 supply & delivery of manhole cover and frame HD20-500', 'Nos', 'N', 3130.53, 'Material', true],
  ['MC-HW-004', 'Manufacture as per BIS:12592 supply & delivery of manhole cover and frame HD10-560', 'Nos', 'N', 2455.73, 'Material', true],
  ['MC-HW-005', 'Manufacture as per BIS:12592 supply & delivery of manhole cover and frame 24x18 MD10', 'Nos', 'N', 2435.96, 'Material', true],
  ['MC-HW-006', 'Manufacture as per BIS:12592 supply & delivery of manhole cover and frame HD20 560', 'Nos', 'N', 3356.7, 'Material', true],
  ['MC-HW-007', 'Manufacture as per BIS:12592 supply & delivery of manhole cover and frame HD35 560', 'Nos', 'N', 3597.7, 'Material', true],
  ['MC-HW-008', 'Manufacture as per BIS:12592 supply & delivery of manhole cover and frame 24x24 MD10', 'Nos', 'N', 2647.3, 'Material', true],
  ['MC-HW-009', 'Manufacture as per BIS:12592 supply & delivery of manhole cover and frame 24x24 HD20', 'Nos', 'N', 2976.05, 'Material', true],
  // Concrete
  ['CC-HW-001', 'Plain Cement concrete (1:4:8) using OPC, 40mm metal with concrete mixer all work up to plinth level', 'CUM', 'LxBxD', 5357.71, 'Civil', false],
  ['CC-HW-002', 'Plain Cement concrete nominal mix (1:3:6) using 40mm HG metal', 'CUM', 'LxBxD', 5786.19, 'Civil', false],
  ['CC-HW-003', 'Plain Cement concrete (1:2:4) nominal mix using 20mm HG machine crushed graded metal', 'CUM', 'LxBxD', 6464.42, 'Civil', false],
  ['CC-HW-004', 'Plain Cement concrete (1:2:4) nominal mix using 20mm HG metal - alternate rate', 'CUM', 'LxBxD', 6233.54, 'Civil', false],
  ['CC-HW-005', 'PCC Grade M15 nominal mix (1:2.5:5) hand mixing using 40mm down graded HG metal', 'CUM', 'LxBxD', 6200.21, 'Civil', false],
  // Brick Masonry
  ['BRK-HW-001', 'Brick masonry in CM 1:4 with traditional 23x11x7cm 2nd class bricks for super structure', 'CUM', 'LxBxD', 9091.36, 'Civil', false],
  ['BRK-HW-002', 'Brick masonry in CM 1:5 with traditional 23x11x7cm 2nd class bricks for super structure', 'CUM', 'LxBxD', 9007.7, 'Civil', false],
  // Stone Masonry
  ['STM-HW-001', 'Construction of Coursed Rubble Stone Masonry 2nd Sort Cum-1 in CM 1:6 using hard granite stone', 'CUM', 'LxBxD', 7091.42, 'Civil', false],
  ['STM-HW-002', 'Construction of Coursed Rubble Stone Masonry 2nd Sort Cum-2 in CM 1:6 using hard granite stone', 'CUM', 'LxBxD', 6205.86, 'Civil', false],
  ['STM-HW-003', 'Reconstruction of Coursed Rubble Stone Masonry 2nd sort in CM 1:6 using hard granite stone', 'CUM', 'LxBxD', 4553.2, 'Civil', false],
  // Pointing
  ['PNT-HW-001', 'Raised Pointing with CM 1:3 to RR Masonry', 'SQM', 'LxB', 155.13, 'Civil', false],
  ['PNT-HW-002', 'Flush Pointing with CM 1:3 to Brick/CRS Masonry', 'SQM', 'LxB', 137.82, 'Civil', false],
  // Flooring
  ['FLR-HW-001', 'Flooring with 15-18mm thick polished shabad stones over base coat CM 1:8 20mm thick', 'SQM', 'LxB', 984.12, 'Civil', false],
  ['FLR-HW-002', 'Flooring with 40mm thick Rough Shabad stones set over base coat CM 1:8 12mm thick', 'SQM', 'LxB', 973.7, 'Civil', false],
  // Dewatering
  ['DEW-HW-001', 'Dewatering pipeline trenches with 5 HP engine driven pump per hour', '5 Hp-Hr', 'N', 430.93, 'Civil', false],
  ['DEW-HW-002', 'Dewatering pipeline trenches with 10 HP engine driven pump per hour', '10 Hp-Hr', 'N', 584.47, 'Civil', false],
  ['DEW-HW-003', 'Dewatering pipeline trenches with 5HP pump per hour - alternate rate', '5 Hp-Hr', 'N', 269.08, 'Civil', false],
  ['DEW-HW-004', 'Dewatering pipeline trenches with 10HP pump per hour - alternate rate', '10 Hp-Hr', 'N', 332.8, 'Civil', false],
  // Manhole Frame & Cover
  ['MC-HW-010', 'Manhole Frame & Cover 24x18 HD 20', 'Nos', 'N', 3031.66, 'Material', true],
  // Plastering
  ['PLSTR-HW-002', 'Plastering to ceiling 12mm thick single coat CM 1:3 dubara sponge finish', 'SQM', 'LxB', 245.84, 'Civil', false],
  ['PLSTR-HW-003', 'Plastering to brick masonry wall 20mm thick double coat CM 1:6+1:4 dubara sponge finish for uneven/outer walls', 'SQM', 'LxB', 682.83, 'Civil', false],
  // RCC Pipe Testing
  ['RCC-HW-001', '350mm dia NP2 - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 305.9, 'Civil', false],
  ['RCC-HW-002', '400mm dia NP2 - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 339.8, 'Civil', false],
  ['RCC-HW-003', '450mm dia NP2 - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 373, 'Civil', false],
  ['RCC-HW-004', '500mm dia NP2 - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 421.2, 'Civil', false],
  ['RCC-HW-005', '600mm dia NP3 - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 524.9, 'Civil', false],
  // Uprooting SWG
  ['SWG-HW-001', 'Uprooting and Re-doing 100mm dia SWG pipe line incl. earth work', 'RMT', 'L', 312.4, 'Civil', false],
  ['SWG-HW-002', 'Uprooting and Re-doing 150mm dia SWG pipe line incl. earth work', 'RMT', 'L', 416.6, 'Civil', false],
  // Manhole Construction
  ['MH-HW-003', 'Construction of 1.2 x 1.2 m MH (1.80 mts depth)', 'Nos', 'N', 38593, 'Civil', false],
  ['MH-HW-004', 'Construction of 1.2 x 1.2 m MH additional depth', 'Nos', 'N', 2260, 'Civil', false],
  ['MH-HW-005', 'Construction of 0.9 x 0.9 m MH (1.00 mts depth)', 'Nos', 'N', 15369, 'Civil', false],
  ['MH-HW-006', 'Construction of 0.9 x 0.9 m MH additional depth', 'Nos', 'N', 1154, 'Civil', false],
  ['MH-HW-007', 'Removing & Raising of RCC precast manhole chamber with CC 1:4:8 and 1:2:4 benching - per Nos', 'Nos', 'N', 6413, 'Civil', false],
  // Fabrication
  ['FAB-HW-001', 'MS Plate - Fabrication charges', 'MT', 'N', 6500, 'Civil', false],
  // Brick Masonry variants
  ['BRK-HW-003', 'Brick masonry in CM 1:6 with 2nd class traditional 23x11x7cm bricks for super structure', 'CUM', 'LxBxD', 9746.72, 'Civil', false],
  ['BRK-HW-004', '11.5cm wide brick masonry for super-structure in CM 1:3 using 23x11x7cm bricks', 'CUM', 'LxBxD', 12738.27, 'Civil', false],
  // Ventilating shafts
  ['VNT-HW-001', 'Labour charges for fixing ventilating shafts in sewerage scheme with accessories', 'Nos', 'N', 2988.04, 'Civil', false],
  // Lowering CI/DI pipes (labour)
  ['CILAY-HW-001', '4"/100mm - Lowering CI/DI pipes and specials into trenches and laying to alignment', 'Nos', 'N', 68, 'Civil', false],
  ['CILAY-HW-002', '6"/150mm - Lowering CI/DI pipes and specials into trenches and laying to alignment', 'Nos', 'N', 110.7, 'Civil', false],
  ['CILAY-HW-003', '8"/200mm - Lowering CI/DI pipes and specials into trenches and laying to alignment', 'Nos', 'N', 161, 'Civil', false],
  ['CILAY-HW-004', '10"/250mm - Lowering CI/DI pipes and specials into trenches and laying to alignment', 'Nos', 'N', 217.5, 'Civil', false],
  ['CILAY-HW-005', '12"/300mm - Lowering CI/DI pipes and specials into trenches and laying to alignment', 'Nos', 'N', 281.3, 'Civil', false],
  ['CILAY-HW-006', '14"/350mm - Lowering CI/DI pipes and specials into trenches and laying to alignment', 'Nos', 'N', 352.9, 'Civil', false],
  ['CILAY-HW-007', '16"/400mm - Lowering CI/DI pipes and specials into trenches and laying to alignment', 'Nos', 'N', 430.6, 'Civil', false],
  ['CILAY-HW-008', '18"/450mm - Lowering CI/DI pipes and specials into trenches and laying to alignment', 'Nos', 'N', 521, 'Civil', false],
  ['CILAY-HW-009', '20"/500mm - Lowering CI/DI pipes and specials into trenches and laying to alignment', 'Nos', 'N', 607.3, 'Civil', false],
  ['CILAY-HW-010', '24"/600mm - Lowering CI/DI pipes and specials into trenches and laying to alignment', 'Nos', 'N', 810.8, 'Civil', false],
  // CI Pipe Testing
  ['CITST-HW-001', '4"/100mm - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 292.5, 'Civil', false],
  ['CITST-HW-002', '6"/150mm - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 363.7, 'Civil', false],
  ['CITST-HW-003', '8"/200mm - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 400, 'Civil', false],
  ['CITST-HW-004', '10"/250mm - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 449.2, 'Civil', false],
  ['CITST-HW-005', '12"/300mm - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 511.2, 'Civil', false],
  ['CITST-HW-006', '14"/350mm - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 610.9, 'Civil', false],
  ['CITST-HW-007', '16"/400mm - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 620.4, 'Civil', false],
  ['CITST-HW-008', '18"/450mm - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 762, 'Civil', false],
  ['CITST-HW-009', '20"/500mm - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 824.1, 'Civil', false],
  ['CITST-HW-010', '24"/600mm - Testing of pipe lines with required pressure incl. filling water', 'Nos', 'N', 968.3, 'Civil', false],
  // Jointing CI/DI (excluding rubber gasket)
  ['CIJNT-HW-001', '4"/100mm - Jointing CI/DI pipes and fittings with rubber gaskets (excl. rubber gasket)', 'Nos', 'N', 186.6, 'Civil', false],
  ['CIJNT-HW-002', '6"/150mm - Jointing CI/DI pipes and fittings with rubber gaskets (excl. rubber gasket)', 'Nos', 'N', 227, 'Civil', false],
  ['CIJNT-HW-003', '8"/200mm - Jointing CI/DI pipes and fittings with rubber gaskets (excl. rubber gasket)', 'Nos', 'N', 247.7, 'Civil', false],
  ['CIJNT-HW-004', '10"/250mm - Jointing CI/DI pipes and fittings with rubber gaskets (excl. rubber gasket)', 'Nos', 'N', 280, 'Civil', false],
  ['CIJNT-HW-005', '12"/300mm - Jointing CI/DI pipes and fittings with rubber gaskets (excl. rubber gasket)', 'Nos', 'N', 319, 'Civil', false],
  ['CIJNT-HW-006', '14"/350mm - Jointing CI/DI pipes and fittings with rubber gaskets (excl. rubber gasket)', 'Nos', 'N', 378.2, 'Civil', false],
  ['CIJNT-HW-007', '16"/400mm - Jointing CI/DI pipes and fittings with rubber gaskets (excl. rubber gasket)', 'Nos', 'N', 409.2, 'Civil', false],
  ['CIJNT-HW-008', '18"/450mm - Jointing CI/DI pipes and fittings with rubber gaskets (excl. rubber gasket)', 'Nos', 'N', 469.1, 'Civil', false],
  ['CIJNT-HW-009', '20"/500mm - Jointing CI/DI pipes and fittings with rubber gaskets (excl. rubber gasket)', 'Nos', 'N', 509.4, 'Civil', false],
  ['CIJNT-HW-010', '24"/600mm - Jointing CI/DI pipes and fittings with rubber gaskets (excl. rubber gasket)', 'Nos', 'N', 590.1, 'Civil', false],
  // Jointing CI/DI flanged ends (excl bolts)
  ['CIJNT-HW-011', '4"/100mm - Jointing CI/DI pipes and valves with flanged ends (excl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 171.2, 'Civil', false],
  ['CIJNT-HW-012', '6"/150mm - Jointing CI/DI pipes and valves with flanged ends (excl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 202.8, 'Civil', false],
  ['CIJNT-HW-013', '8"/200mm - Jointing CI/DI pipes and valves with flanged ends (excl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 214.3, 'Civil', false],
  ['CIJNT-HW-014', '10"/250mm - Jointing CI/DI pipes and valves with flanged ends (excl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 237.6, 'Civil', false],
  ['CIJNT-HW-015', '12"/300mm - Jointing CI/DI pipes and valves with flanged ends (excl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 268.2, 'Civil', false],
  ['CIJNT-HW-016', '14"/350mm - Jointing CI/DI pipes and valves with flanged ends (excl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 319.3, 'Civil', false],
  ['CIJNT-HW-017', '16"/400mm - Jointing CI/DI pipes and valves with flanged ends (excl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 340.9, 'Civil', false],
  ['CIJNT-HW-018', '18"/450mm - Jointing CI/DI pipes and valves with flanged ends (excl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 392.8, 'Civil', false],
  ['CIJNT-HW-019', '20"/500mm - Jointing CI/DI pipes and valves with flanged ends (excl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 424.5, 'Civil', false],
  ['CIJNT-HW-020', '24"/600mm - Jointing CI/DI pipes and valves with flanged ends (excl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 487.8, 'Civil', false],
  // Jointing CI/DI flanged ends (incl bolts)
  ['CIJNT-HW-021', '4"/100mm - Jointing CI/DI pipes and valves with flanged ends (incl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 348.3, 'Civil', false],
  ['CIJNT-HW-022', '6"/150mm - Jointing CI/DI pipes and valves with flanged ends (incl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 513.1, 'Civil', false],
  ['CIJNT-HW-023', '8"/200mm - Jointing CI/DI pipes and valves with flanged ends (incl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 560.3, 'Civil', false],
  ['CIJNT-HW-024', '10"/250mm - Jointing CI/DI pipes and valves with flanged ends (incl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 766.9, 'Civil', false],
  ['CIJNT-HW-025', '12"/300mm - Jointing CI/DI pipes and valves with flanged ends (incl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 819.3, 'Civil', false],
  ['CIJNT-HW-026', '14"/350mm - Jointing CI/DI pipes and valves with flanged ends (incl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 1164.1, 'Civil', false],
  ['CIJNT-HW-027', '16"/400mm - Jointing CI/DI pipes and valves with flanged ends (incl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 1736.1, 'Civil', false],
  ['CIJNT-HW-028', '18"/450mm - Jointing CI/DI pipes and valves with flanged ends (incl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 1990.8, 'Civil', false],
  ['CIJNT-HW-029', '20"/500mm - Jointing CI/DI pipes and valves with flanged ends (incl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 2331.1, 'Civil', false],
  ['CIJNT-HW-030', '24"/600mm - Jointing CI/DI pipes and valves with flanged ends (incl. bolts, nuts, rubber insertion, white lead)', 'Nos', 'N', 3182.8, 'Civil', false],
  // Lowering CI sluice valve (labour)
  ['CIVLV-HW-001', '4"/100mm - Lowering of CI sluice valve (labour charges)', 'Nos', 'N', 270.9, 'Civil', false],
  ['CIVLV-HW-002', '6"/150mm - Lowering of CI sluice valve (labour charges)', 'Nos', 'N', 459.2, 'Civil', false],
  ['CIVLV-HW-003', '8"/200mm - Lowering of CI sluice valve (labour charges)', 'Nos', 'N', 757.5, 'Civil', false],
  ['CIVLV-HW-004', '10"/250mm - Lowering of CI sluice valve (labour charges)', 'Nos', 'N', 1076.6, 'Civil', false],
  ['CIVLV-HW-005', '12"/300mm - Lowering of CI sluice valve (labour charges)', 'Nos', 'N', 1532.7, 'Civil', false],
  ['CIVLV-HW-006', '14"/350mm - Lowering of CI sluice valve (labour charges)', 'Nos', 'N', 2588.4, 'Civil', false],
  ['CIVLV-HW-007', '16"/400mm - Lowering of CI sluice valve (labour charges)', 'Nos', 'N', 3178, 'Civil', false],
  ['CIVLV-HW-008', '18"/450mm - Lowering of CI sluice valve (labour charges)', 'Nos', 'N', 4155.8, 'Civil', false],
  ['CIVLV-HW-009', '20"/500mm - Lowering of CI sluice valve (labour charges)', 'Nos', 'N', 4817.3, 'Civil', false],
  ['CIVLV-HW-010', '24"/600mm - Lowering of CI sluice valve (labour charges)', 'Nos', 'N', 8182.2, 'Civil', false],
  // Rubber Gaskets (material supply)
  ['SUP-HW-006', '4"/100mm - Cost of rubber gaskets as per BIS:5382/85', 'Nos', 'N', 136.92, 'Material', true],
  ['SUP-HW-007', '6"/150mm - Cost of rubber gaskets as per BIS:5382/85', 'Nos', 'N', 201.07, 'Material', true],
  ['SUP-HW-008', '8"/200mm - Cost of rubber gaskets as per BIS:5382/85', 'Nos', 'N', 244.24, 'Material', true],
  ['SUP-HW-009', '10"/250mm - Cost of rubber gaskets as per BIS:5382/85', 'Nos', 'N', 271.38, 'Material', true],
  ['SUP-HW-010', '12"/300mm - Cost of rubber gaskets as per BIS:5382/85', 'Nos', 'N', 414.47, 'Material', true],
  ['SUP-HW-011', '14"/350mm - Cost of rubber gaskets as per BIS:5382/85', 'Nos', 'N', 524.25, 'Material', true],
  ['SUP-HW-012', '16"/400mm - Cost of rubber gaskets as per BIS:5382/85', 'Nos', 'N', 569.9, 'Material', true],
  ['SUP-HW-013', '18"/450mm - Cost of rubber gaskets as per BIS:5382/85', 'Nos', 'N', 613.07, 'Material', true],
  ['SUP-HW-014', '20"/500mm - Cost of rubber gaskets as per BIS:5382/85', 'Nos', 'N', 852.52, 'Material', true],
  ['SUP-HW-015', '24"/600mm - Cost of rubber gaskets as per BIS:5382/85', 'Nos', 'N', 1009.04, 'Material', true],
  // DI Pipes K9 (Material supply)
  ['SUP-HW-016', '4"/100mm - Cost of DI pipes per Rmt (K9) as per IS:8329/200', 'RMT', 'L', 1873.16, 'Material', true],
  ['SUP-HW-017', '6"/150mm - Cost of DI pipes per Rmt (K9) as per IS:8329/200', 'RMT', 'L', 2780.05, 'Material', true],
  ['SUP-HW-018', '8"/200mm - Cost of DI pipes per Rmt (K9) as per IS:8329/200', 'RMT', 'L', 3718.55, 'Material', true],
  ['SUP-HW-019', '10"/250mm - Cost of DI pipes per Rmt (K9) as per IS:8329/200', 'RMT', 'L', 4868.76, 'Material', true],
  ['SUP-HW-020', '12"/300mm - Cost of DI pipes per Rmt (K9) as per IS:8329/200', 'RMT', 'L', 6135.39, 'Material', true],
  ['SUP-HW-021', '14"/350mm - Cost of DI pipes per Rmt (K9) as per IS:8329/200', 'RMT', 'L', 7695.69, 'Material', true],
  ['SUP-HW-022', '16"/400mm - Cost of DI pipes per Rmt (K9) as per IS:8329/200', 'RMT', 'L', 9200.38, 'Material', true],
  ['SUP-HW-023', '18"/450mm - Cost of DI pipes per Rmt (K9) as per IS:8329/200', 'RMT', 'L', 11027.91, 'Material', true],
  ['SUP-HW-024', '20"/500mm - Cost of DI pipes per Rmt (K9) as per IS:8329/200', 'RMT', 'L', 12838.3, 'Material', true],
  ['SUP-HW-025', '24"/600mm - Cost of DI pipes per Rmt (K9) as per IS:8329/200', 'RMT', 'L', 16933.85, 'Material', true],
  // DI Pipes K7 (Material supply)
  ['SUP-HW-026', '4"/100mm - Cost of DI pipes per Rmt (K7) as per IS:8329/2000', 'RMT', 'L', 1600.55, 'Material', true],
  ['SUP-HW-027', '6"/150mm - Cost of DI pipes per Rmt (K7) as per IS:8329/2000', 'RMT', 'L', 2264.43, 'Material', true],
  ['SUP-HW-028', '8"/200mm - Cost of DI pipes per Rmt (K7) as per IS:8329/2000', 'RMT', 'L', 3010.72, 'Material', true],
  ['SUP-HW-029', '10"/250mm - Cost of DI pipes per Rmt (K7) as per IS:8329/2000', 'RMT', 'L', 4007.2, 'Material', true],
  ['SUP-HW-030', '12"/300mm - Cost of DI pipes per Rmt (K7) as per IS:8329/2000', 'RMT', 'L', 5195.43, 'Material', true],
  ['SUP-HW-031', '14"/350mm - Cost of DI pipes per Rmt (K7) as per IS:8329/2000', 'RMT', 'L', 6478.86, 'Material', true],
  ['SUP-HW-032', '16"/400mm - Cost of DI pipes per Rmt (K7) as per IS:8329/2000', 'RMT', 'L', 7794.37, 'Material', true],
  ['SUP-HW-033', '18"/450mm - Cost of DI pipes per Rmt (K7) as per IS:8329/2000', 'RMT', 'L', 9352.66, 'Material', true],
  ['SUP-HW-034', '20"/500mm - Cost of DI pipes per Rmt (K7) as per IS:8329/2000', 'RMT', 'L', 11113.25, 'Material', true],
  ['SUP-HW-035', '24"/600mm - Cost of DI pipes per Rmt (K7) as per IS:8329/2000', 'RMT', 'L', 14852.87, 'Material', true],
  // Uprooting CI pipes
  ['CIUPR-HW-001', '4"/100mm - Uprooting of CI pipes by melting lead, loosening joints, separating pipes', 'RMT', 'L', 133.5, 'Civil', false],
  ['CIUPR-HW-002', '6"/150mm - Uprooting of CI pipes by melting lead, loosening joints, separating pipes', 'RMT', 'L', 167.4, 'Civil', false],
  ['CIUPR-HW-003', '8"/200mm - Uprooting of CI pipes by melting lead, loosening joints, separating pipes', 'RMT', 'L', 202.4, 'Civil', false],
  ['CIUPR-HW-004', '10"/250mm - Uprooting of CI pipes by melting lead, loosening joints, separating pipes', 'RMT', 'L', 236, 'Civil', false],
  ['CIUPR-HW-005', '12"/300mm - Uprooting of CI pipes by melting lead, loosening joints, separating pipes', 'RMT', 'L', 267.1, 'Civil', false],
  ['CIUPR-HW-006', '14"/350mm - Uprooting of CI pipes by melting lead, loosening joints, separating pipes', 'RMT', 'L', 299.7, 'Civil', false],
  ['CIUPR-HW-007', '16"/400mm - Uprooting of CI pipes by melting lead, loosening joints, separating pipes', 'RMT', 'L', 331.5, 'Civil', false],
  ['CIUPR-HW-008', '18"/450mm - Uprooting of CI pipes by melting lead, loosening joints, separating pipes', 'RMT', 'L', 363.9, 'Civil', false],
  ['CIUPR-HW-009', '20"/500mm - Uprooting of CI pipes by melting lead, loosening joints, separating pipes', 'RMT', 'L', 396.3, 'Civil', false],
  ['CIUPR-HW-010', '24"/600mm - Uprooting of CI pipes by melting lead, loosening joints, separating pipes', 'RMT', 'L', 458.2, 'Civil', false],
  // DI Sluice Valves (Material supply)
  ['SUP-HW-036', '4"/100mm - DI D/F sluice valves conforming to IS 3896 Part 2:1985 grade GGG 40, PN 10', 'Nos', 'N', 16027.43, 'Material', true],
  ['SUP-HW-037', '6"/150mm - DI D/F sluice valves conforming to IS 3896 Part 2:1985 grade GGG 40, PN 10', 'Nos', 'N', 25234.75, 'Material', true],
  ['SUP-HW-038', '8"/200mm - DI D/F sluice valves conforming to IS 3896 Part 2:1985 grade GGG 40, PN 10', 'Nos', 'N', 41933.75, 'Material', true],
  ['SUP-HW-039', '10"/250mm - DI D/F sluice valves conforming to IS 3896 Part 2:1985 grade GGG 40, PN 10', 'Nos', 'N', 58079.76, 'Material', true],
  ['SUP-HW-040', '12"/300mm - DI D/F sluice valves conforming to IS 3896 Part 2:1985 grade GGG 40, PN 10', 'Nos', 'N', 87778.32, 'Material', true],
  ['SUP-HW-041', '14"/350mm - DI D/F sluice valves conforming to IS 3896 Part 2:1985 grade GGG 40, PN 10', 'Nos', 'N', 265764.73, 'Material', true],
  ['SUP-HW-042', '16"/400mm - DI D/F sluice valves conforming to IS 3896 Part 2:1985 grade GGG 40, PN 10', 'Nos', 'N', 278744.96, 'Material', true],
  ['SUP-HW-043', '18"/450mm - DI D/F sluice valves conforming to IS 3896 Part 2:1985 grade GGG 40, PN 10', 'Nos', 'N', 479560.85, 'Material', true],
  ['SUP-HW-044', '20"/500mm - DI D/F sluice valves conforming to IS 3896 Part 2:1985 grade GGG 40, PN 10', 'Nos', 'N', 509261.99, 'Material', true],
  ['SUP-HW-045', '24"/600mm - DI D/F sluice valves conforming to IS 3896 Part 2:1985 grade GGG 40, PN 10', 'Nos', 'N', 655783.91, 'Material', true],
  // DI Butterfly Valves (Material supply)
  ['SUP-HW-046', '6"/150mm - DI D/F Butterfly valves conforming to IS 3896 part 2 grade GGG 40 PN 10', 'Nos', 'N', 101136.23, 'Material', true],
  ['SUP-HW-047', '8"/200mm - DI D/F Butterfly valves conforming to IS 3896 part 2 grade GGG 40 PN 10', 'Nos', 'N', 110152.78, 'Material', true],
  ['SUP-HW-048', '10"/250mm - DI D/F Butterfly valves conforming to IS 3896 part 2 grade GGG 40 PN 10', 'Nos', 'N', 128343.15, 'Material', true],
  ['SUP-HW-049', '12"/300mm - DI D/F Butterfly valves conforming to IS 3896 part 2 grade GGG 40 PN 10', 'Nos', 'N', 153140.93, 'Material', true],
  ['SUP-HW-050', '14"/350mm - DI D/F Butterfly valves conforming to IS 3896 part 2 grade GGG 40 PN 10', 'Nos', 'N', 175217.64, 'Material', true],
  ['SUP-HW-051', '16"/400mm - DI D/F Butterfly valves conforming to IS 3896 part 2 grade GGG 40 PN 10', 'Nos', 'N', 220689.69, 'Material', true],
  ['SUP-HW-052', '18"/450mm - DI D/F Butterfly valves conforming to IS 3896 part 2 grade GGG 40 PN 10', 'Nos', 'N', 242277.86, 'Material', true],
  ['SUP-HW-053', '20"/500mm - DI D/F Butterfly valves conforming to IS 3896 part 2 grade GGG 40 PN 10', 'Nos', 'N', 244580.02, 'Material', true],
  ['SUP-HW-054', '24"/600mm - DI D/F Butterfly valves conforming to IS 3896 part 2 grade GGG 40 PN 10', 'Nos', 'N', 320556.25, 'Material', true],
  // Cutting CI pipe
  ['CICUT-HW-001', '4"/100mm - Cutting of CI pipe without water', 'Nos', 'N', 155.5, 'Civil', false],
  ['CICUT-HW-002', '6"/150mm - Cutting of CI pipe without water', 'Nos', 'N', 291.5, 'Civil', false],
  ['CICUT-HW-003', '8"/200mm - Cutting of CI pipe without water', 'Nos', 'N', 388.7, 'Civil', false],
  ['CICUT-HW-004', '10"/250mm - Cutting of CI pipe without water', 'Nos', 'N', 485.9, 'Civil', false],
  ['CICUT-HW-005', '12"/300mm - Cutting of CI pipe without water', 'Nos', 'N', 583.1, 'Civil', false],
  ['CICUT-HW-006', '14"/350mm - Cutting of CI pipe without water', 'Nos', 'N', 680.2, 'Civil', false],
  ['CICUT-HW-007', '16"/400mm - Cutting of CI pipe without water', 'Nos', 'N', 777.4, 'Civil', false],
  ['CICUT-HW-008', '18"/450mm - Cutting of CI pipe without water', 'Nos', 'N', 874.6, 'Civil', false],
  ['CICUT-HW-009', '20"/500mm - Cutting of CI pipe without water', 'Nos', 'N', 971.8, 'Civil', false],
  ['CICUT-HW-010', '24"/600mm - Cutting of CI pipe without water', 'Nos', 'N', 1166.1, 'Civil', false],
  // Transportation charges DI K7
  ['TRANS-HW-001', '4"/100mm - Transportation charges 8km lead for DI K7 pipes per Rmt', 'RMT', 'L', 2.48, 'Material', false],
  ['TRANS-HW-002', '6"/150mm - Transportation charges 8km lead for DI K7 pipes per Rmt', 'RMT', 'L', 3.52, 'Material', false],
  ['TRANS-HW-003', '8"/200mm - Transportation charges 8km lead for DI K7 pipes per Rmt', 'RMT', 'L', 3.52, 'Material', false],
  ['TRANS-HW-004', '10"/250mm - Transportation charges 8km lead for DI K7 pipes per Rmt', 'RMT', 'L', 4.64, 'Material', false],
  ['TRANS-HW-005', '12"/300mm - Transportation charges 8km lead for DI K7 pipes per Rmt', 'RMT', 'L', 6.96, 'Material', false],
  ['TRANS-HW-006', '14"/350mm - Transportation charges 8km lead for DI K7 pipes per Rmt', 'RMT', 'L', 8.16, 'Material', false],
  ['TRANS-HW-007', '16"/400mm - Transportation charges 8km lead for DI K7 pipes per Rmt', 'RMT', 'L', 9.36, 'Material', false],
  ['TRANS-HW-008', '18"/450mm - Transportation charges 8km lead for DI K7 pipes per Rmt', 'RMT', 'L', 11.68, 'Material', false],
  ['TRANS-HW-009', '20"/500mm - Transportation charges 8km lead for DI K7 pipes per Rmt', 'RMT', 'L', 14, 'Material', false],
  ['TRANS-HW-010', '24"/600mm - Transportation charges 8km lead for DI K7 pipes per Rmt', 'RMT', 'L', 19.92, 'Material', false],
  // Transportation charges DI K9
  ['TRANS-HW-011', '4"/100mm - Transportation charges 8km lead for DI K9 pipes per Rmt', 'RMT', 'L', 2.48, 'Material', false],
  ['TRANS-HW-012', '6"/150mm - Transportation charges 8km lead for DI K9 pipes per Rmt', 'RMT', 'L', 3.52, 'Material', false],
  ['TRANS-HW-013', '8"/200mm - Transportation charges 8km lead for DI K9 pipes per Rmt', 'RMT', 'L', 3.52, 'Material', false],
  ['TRANS-HW-014', '10"/250mm - Transportation charges 8km lead for DI K9 pipes per Rmt', 'RMT', 'L', 4.64, 'Material', false],
  ['TRANS-HW-015', '12"/300mm - Transportation charges 8km lead for DI K9 pipes per Rmt', 'RMT', 'L', 6.96, 'Material', false],
  ['TRANS-HW-016', '14"/350mm - Transportation charges 8km lead for DI K9 pipes per Rmt', 'RMT', 'L', 8.16, 'Material', false],
  ['TRANS-HW-017', '16"/400mm - Transportation charges 8km lead for DI K9 pipes per Rmt', 'RMT', 'L', 9.36, 'Material', false],
  ['TRANS-HW-018', '18"/450mm - Transportation charges 8km lead for DI K9 pipes per Rmt', 'RMT', 'L', 11.68, 'Material', false],
  ['TRANS-HW-019', '20"/500mm - Transportation charges 8km lead for DI K9 pipes per Rmt', 'RMT', 'L', 14, 'Material', false],
  ['TRANS-HW-020', '24"/600mm - Transportation charges 8km lead for DI K9 pipes per Rmt', 'RMT', 'L', 19.92, 'Material', false],
  // SWG pipes
  ['SUP-HW-055', '200mm dia SWG pipe (SP-1) per RMT incl. GST', 'CUM', 'N', 763.79, 'Material', true],
  ['SUP-HW-056', '250mm dia SWG pipe (SP-1) per RMT incl. GST', 'CUM', 'N', 1396.57, 'Material', true],
  ['SUP-HW-057', '300mm dia SWG pipe (SP-1) per RMT incl. GST', 'CUM', 'N', 2012.05, 'Material', true],
  ['SUP-HW-058', '350mm dia SWG pipe (SP-1) per RMT incl. GST', 'CUM', 'N', 2737.52, 'Material', true],
  ['SUP-HW-059', '400mm dia SWG pipe (SP-2) per RMT incl. GST', 'CUM', 'N', 3391.31, 'Material', true],
  // Air Valves
  ['SUP-HW-060', '40mm dia DI D/F Kinetic Air Valve as per IS:14845', 'Nos', 'N', 23034.43, 'Material', true],
  ['SUP-HW-061', '50mm dia DI D/F Kinetic Air Valve as per IS:14845', 'Nos', 'N', 39630.31, 'Material', true],
  ['SUP-HW-062', '80mm dia DI D/F Kinetic Air Valve as per IS:14845', 'Nos', 'N', 52869.62, 'Material', true],
  ['SUP-HW-063', '100mm dia DI D/F Kinetic Air Valve as per IS:14845', 'Nos', 'N', 61727.63, 'Material', true],
  ['SUP-HW-064', '150mm dia DI D/F Kinetic Air Valve as per IS:14845', 'Nos', 'N', 75146.12, 'Material', true],
  ['SUP-HW-065', '200mm dia DI D/F Kinetic Air Valve as per IS:14845', 'Nos', 'N', 82302.65, 'Material', true],
  // OHSR/ELSR rates
  ['OHSR-HW-001', '500 KL - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 19.68, 'Civil', false],
  ['OHSR-HW-002', '1000 KL - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 15.99, 'Civil', false],
  ['OHSR-HW-003', '1500 KL - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 14.77, 'Civil', false],
  ['OHSR-HW-004', '2000 KL - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 13.95, 'Civil', false],
  ['OHSR-HW-005', '2500 KL - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 13.23, 'Civil', false],
  ['OHSR-HW-006', '10000 L - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 91.19, 'Civil', false],
  ['OHSR-HW-007', '20000 L - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 54.21, 'Civil', false],
  ['OHSR-HW-008', '40000 L - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 43.66, 'Civil', false],
  ['OHSR-HW-009', '60000 L - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 31.1, 'Civil', false],
  ['OHSR-HW-010', '100000 L - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 27.5, 'Civil', false],
  ['OHSR-HW-011', '120000 L - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 24.04, 'Civil', false],
  ['OHSR-HW-012', '150000 L - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 21.84, 'Civil', false],
  ['OHSR-HW-013', '200000 L - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 20.6, 'Civil', false],
  ['OHSR-HW-014', '250000 L - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 19.99, 'Civil', false],
  ['OHSR-HW-015', '300000 L - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 19.33, 'Civil', false],
  ['OHSR-HW-016', '400000 L - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 16.89, 'Civil', false],
  ['OHSR-HW-017', '450000 L - OHSR/ELSR staging 12m Zone-II Seismic per ltr', 'Per Ltr', 'N', 15.06, 'Civil', false],
  // DI fittings
  ['SUP-HW-066', 'Up to 500mm dia - Centrifugally cast DI fittings conforming to IS:9523/2000', 'KG', 'N', 169.15, 'Material', false],
  ['SUP-HW-067', 'Up to 300mm dia - Centrifugally cast DI fittings conforming to IS:9523/2000', 'KG', 'N', 169.15, 'Material', false],
  ['SUP-HW-068', 'Up to 500x450mm dia - Centrifugally cast DI fittings conforming to IS:9523/2000', 'KG', 'N', 169.15, 'Material', false],
  ['SUP-HW-069', 'Above 500mm dia - Centrifugally cast DI fittings conforming to IS:9523/2000', 'KG', 'N', 185.22, 'Material', false],
  ['SUP-HW-070', 'Above 300mm dia - Centrifugally cast DI fittings conforming to IS:9523/2000', 'KG', 'N', 185.22, 'Material', false],
  // Conveyance SWG
  ['CONV-HW-002', '200mm - Conveyance of SWG pipes up to 25km lead per Rmt', 'RMT', 'L', 20.3, 'Material', false],
  ['CONV-HW-003', '250mm - Conveyance of SWG pipes up to 25km lead per Rmt', 'RMT', 'L', 20.3, 'Material', false],
  ['CONV-HW-004', '300mm - Conveyance of SWG pipes up to 25km lead per Rmt', 'RMT', 'L', 20.3, 'Material', false],
  // Conveyance CI/DI
  ['CONV-HW-005', '4"/100mm - Conveyance of CI pipes up to 25km lead per MT', 'MT', 'N', 1737.5, 'Material', false],
  ['CONV-HW-006', '6"/150mm - Conveyance of CI pipes up to 25km lead per MT', 'MT', 'N', 1737.5, 'Material', false],
  ['CONV-HW-007', '8"/200mm - Conveyance of CI pipes up to 25km lead per MT', 'MT', 'N', 1737.5, 'Material', false],
  ['CONV-HW-008', '10"/250mm - Conveyance of CI pipes up to 25km lead per MT', 'MT', 'N', 1737.5, 'Material', false],
  ['CONV-HW-009', '12"/300mm - Conveyance of CI pipes up to 25km lead per MT', 'MT', 'N', 1737.5, 'Material', false],
  ['CONV-HW-010', '14"/350mm - Conveyance of CI pipes up to 25km lead per MT', 'MT', 'N', 1737.5, 'Material', false],
  ['CONV-HW-011', '16"/400mm - Conveyance of CI pipes up to 25km lead per MT', 'MT', 'N', 1232, 'Material', false],
  ['CONV-HW-012', '18"/450mm - Conveyance of CI pipes up to 25km lead per MT', 'MT', 'N', 1232, 'Material', false],
  ['CONV-HW-013', '20"/500mm - Conveyance of CI pipes up to 25km lead per MT', 'MT', 'N', 1232, 'Material', false],
  ['CONV-HW-014', '24"/600mm - Conveyance of CI pipes up to 25km lead per MT', 'MT', 'N', 1232, 'Material', false],
  // Dummy arrangement
  ['SUP-HW-071', 'To 100mm dia - Making Dummy arrangement', 'Nos', 'N', 3575.85, 'Civil', false],
  ['SUP-HW-072', 'To 150mm dia - Making Dummy arrangement', 'Nos', 'N', 6051.85, 'Civil', false],
  // HDPE Pipes
  ['SUP-HW-073', '63mm - HDPE pipes 6Kg/sqcm PE-100 Grade', 'RMT', 'L', 124.83, 'Material', true],
  ['SUP-HW-074', '75mm - HDPE pipes 6Kg/sqcm PE-100 Grade', 'RMT', 'L', 174.26, 'Material', true],
  ['SUP-HW-075', '90mm - HDPE pipes 6Kg/sqcm PE-100 Grade', 'RMT', 'L', 250.89, 'Material', true],
  ['SUP-HW-076', '110mm - HDPE pipes 6Kg/sqcm PE-100 Grade', 'RMT', 'L', 421.44, 'Material', true],
  ['SUP-HW-077', '125mm - HDPE pipes 6Kg/sqcm PE-100 Grade', 'RMT', 'L', 489.42, 'Material', true],
  ['SUP-HW-078', '140mm - HDPE pipes 6Kg/sqcm PE-100 Grade', 'RMT', 'L', 610.53, 'Material', true],
  ['SUP-HW-079', '160mm - HDPE pipes 6Kg/sqcm PE-100 Grade', 'RMT', 'L', 803.34, 'Material', true],
  // RCC pipes lowering
  ['RCCLAY-HW-001', '350mm dia NP2 - Lowering RCC S/S pipes including testing and cost of rubber ring', 'Nos', 'N', 305.9, 'Civil', false],
  ['RCCLAY-HW-002', '400mm dia NP2 - Lowering RCC S/S pipes including testing and cost of rubber ring', 'Nos', 'N', 339.8, 'Civil', false],
  ['RCCLAY-HW-003', '450mm dia NP2 - Lowering RCC S/S pipes including testing and cost of rubber ring', 'Nos', 'N', 373, 'Civil', false],
  ['RCCLAY-HW-004', '500mm dia NP2 - Lowering RCC S/S pipes including testing and cost of rubber ring', 'Nos', 'N', 421.2, 'Civil', false],
  ['RCCLAY-HW-005', '600mm dia NP3 - Lowering RCC S/S pipes including testing and cost of rubber ring', 'Nos', 'N', 524.9, 'Civil', false],
  // DI Double Socket Bends - 4"/100
  ['SUP-HW-080', '4"/100mm - DI Double Socket Bend 90 deg', 'Nos', 'N', 1860.65, 'Material', true],
  ['SUP-HW-081', '4"/100mm - DI Double Socket Bend 45 deg', 'Nos', 'N', 1691.5, 'Material', true],
  ['SUP-HW-082', '4"/100mm - DI Double Socket Bend 22.5 deg', 'Nos', 'N', 1522.35, 'Material', true],
  ['SUP-HW-083', '4"/100mm - DI Double Socket Bend 11.5 deg', 'Nos', 'N', 1522.35, 'Material', true],
  // 6"/150
  ['SUP-HW-084', '6"/150mm - DI Double Socket Bend 90 deg', 'Nos', 'N', 3383, 'Material', true],
  ['SUP-HW-085', '6"/150mm - DI Double Socket Bend 45 deg', 'Nos', 'N', 2706.4, 'Material', true],
  ['SUP-HW-086', '6"/150mm - DI Double Socket Bend 22.5 deg', 'Nos', 'N', 2537.25, 'Material', true],
  ['SUP-HW-087', '6"/150mm - DI Double Socket Bend 11.5 deg', 'Nos', 'N', 2368.1, 'Material', true],
  // 8"/200
  ['SUP-HW-088', '8"/200mm - DI Double Socket Bend 90 deg', 'Nos', 'N', 5412.8, 'Material', true],
  ['SUP-HW-089', '8"/200mm - DI Double Socket Bend 45 deg', 'Nos', 'N', 4397.9, 'Material', true],
  ['SUP-HW-090', '8"/200mm - DI Double Socket Bend 22.5 deg', 'Nos', 'N', 3721.3, 'Material', true],
  ['SUP-HW-091', '8"/200mm - DI Double Socket Bend 11.5 deg', 'Nos', 'N', 3552.15, 'Material', true],
  // 10"/250
  ['SUP-HW-092', '10"/250mm - DI Double Socket Bend 90 deg', 'Nos', 'N', 7780.9, 'Material', true],
  ['SUP-HW-093', '10"/250mm - DI Double Socket Bend 45 deg', 'Nos', 'N', 5920.25, 'Material', true],
  ['SUP-HW-094', '10"/250mm - DI Double Socket Bend 22.5 deg', 'Nos', 'N', 4905.35, 'Material', true],
  ['SUP-HW-095', '10"/250mm - DI Double Socket Bend 11.5 deg', 'Nos', 'N', 4736.2, 'Material', true],
  // 12"/300
  ['SUP-HW-096', '12"/300mm - DI Double Socket Bend 90 deg', 'Nos', 'N', 11163.9, 'Material', true],
  ['SUP-HW-097', '12"/300mm - DI Double Socket Bend 45 deg', 'Nos', 'N', 8288.35, 'Material', true],
  ['SUP-HW-098', '12"/300mm - DI Double Socket Bend 22.5 deg', 'Nos', 'N', 7104.3, 'Material', true],
  ['SUP-HW-099', '12"/300mm - DI Double Socket Bend 11.5 deg', 'Nos', 'N', 6427.7, 'Material', true],
  // 14"/350
  ['SUP-HW-100', '14"/350mm - DI Double Socket Bend 90 deg', 'Nos', 'N', 14716.05, 'Material', true],
  ['SUP-HW-101', '14"/350mm - DI Double Socket Bend 45 deg', 'Nos', 'N', 10994.75, 'Material', true],
  ['SUP-HW-102', '14"/350mm - DI Double Socket Bend 22.5 deg', 'Nos', 'N', 9134.1, 'Material', true],
  ['SUP-HW-103', '14"/350mm - DI Double Socket Bend 11.5 deg', 'Nos', 'N', 7950.05, 'Material', true],
  // 16"/400
  ['SUP-HW-104', '16"/400mm - DI Double Socket Bend 90 deg', 'Nos', 'N', 19452.25, 'Material', true],
  ['SUP-HW-105', '16"/400mm - DI Double Socket Bend 45 deg', 'Nos', 'N', 14377.75, 'Material', true],
  ['SUP-HW-106', '16"/400mm - DI Double Socket Bend 22.5 deg', 'Nos', 'N', 11502.2, 'Material', true],
  ['SUP-HW-107', '16"/400mm - DI Double Socket Bend 11.5 deg', 'Nos', 'N', 9810.7, 'Material', true],
  // 18"/450
  ['SUP-HW-108', '18"/450mm - DI Double Socket Bend 90 deg', 'Nos', 'N', 25372.5, 'Material', true],
  ['SUP-HW-109', '18"/450mm - DI Double Socket Bend 45 deg', 'Nos', 'N', 17929.9, 'Material', true],
  ['SUP-HW-110', '18"/450mm - DI Double Socket Bend 22.5 deg', 'Nos', 'N', 14377.75, 'Material', true],
  ['SUP-HW-111', '18"/450mm - DI Double Socket Bend 11.5 deg', 'Nos', 'N', 12855.4, 'Material', true],
  // 20"/500
  ['SUP-HW-112', '20"/500mm - DI Double Socket Bend 90 deg', 'Nos', 'N', 21989.5, 'Material', true],
  ['SUP-HW-113', '20"/500mm - DI Double Socket Bend 45 deg', 'Nos', 'N', 17253.3, 'Material', true],
  ['SUP-HW-114', '20"/500mm - DI Double Socket Bend 22.5 deg', 'Nos', 'N', 15223.5, 'Material', true],
  ['SUP-HW-115', '20"/500mm - DI Double Socket Bend 11.5 deg', 'Nos', 'N', 15223.5, 'Material', true],
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Seeding SoR items (v4)...');
    let created = 0;
    for (const [code, desc, unit, formula, rate, category, gstIncl] of ITEMS) {
      const existing = await client.query('SELECT "ItemID" FROM "ItemMaster" WHERE "ItemCode" = $1', [code]);
      if (existing.rows.length === 0) {
        const item = await client.query(
          `INSERT INTO "ItemMaster" ("ItemCode","Description","Unit","Category","FormulaType","RateIncludesGST","IsActive")
           VALUES ($1,$2,$3,$4,$5,$6,TRUE) RETURNING "ItemID"`,
          [code, desc, unit, category, formula, gstIncl]
        );
        await client.query(
          `INSERT INTO "ItemMasterRateHistory" ("ItemID","Rate","EffectiveFrom")
           VALUES ($1,$2,CURRENT_DATE)`,
          [item.rows[0].ItemID, rate]
        );
        created++;
      }
    }
    await client.query('COMMIT');
    console.log(`Done! Created ${created} new items.\nTotal in DB: ${created + ITEMS.filter(([c]) => false).length + 81}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => { console.error(err); process.exit(1); });
