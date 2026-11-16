// "Saltglass Yard": an original map, a salt refinery at dusk. Each character is a 2 m cell.
// North (row 0) is the Quarry Watch's side, south the attackers'. Two charge sites: A, the

export const CELL = 2;

export const LAYOUT = [
	'########################################',
	'#AAAAAAAAAAA###dddddddddd###BBBBBBBBBBB#',
	'#AAAAAAAAAcA...dcdddddddd...BcBBBBBBBBB#',
	'#AAcCAAAAAAA...dddddddddd...BBBCBBBBBBB#',
	'#AAAcAAAAAAA...ddddddddcd...BBBcBBBcCBB#',
	'#AAAAAAACCAA######....######BBBBBBBBBBB#',
	'#AAAAAAAcAAA######....######BBBBBBBBBBB#',
	'#AwwAAAAAAAA#####......#####BBcBBwwBBBB#',
	'#AAAAAcAAAAA#####.....c#####BBBBBBBBBcB#',
	'#AAAAAAAAAAA#####......#####BBBBBBBBBBB#',
	'#....###...######..cC..######...##.....#',
	'#....##................######...##.....#',
	'#....##....c...........####......#..c..#',
	'#....############..PP..####.c....#.....#',
	'#..c.############.............C..#rrrrr#',
	'#....############.ww.............#rrrrr#',
	'#....############......####......#rrrrr#',
	'#....############......###########rrrrr#',
	'#.C..############....c.###########rrrrr#',
	'#....############C.....###########rrrrr#',
	'#...c############......###########rrrrr#',
	'#....############......###########rrrrr#',
	'#....############......###########.....#',
	'#.............c................ww..C...#',
	'#.......Cc..........c....cC............#',
	'#......................................#',
	'############aaaaaaaaaaaaaaaa############',
	'############aaaaaaaaaaaaaaaa############',
	'############aaaaaaaaaaaaaaaa############',
	'############aaaaaaaaaaaaaaaa############',
	'############aaaaaaaaaaaaaaaa############',
	'########################################',
];

export const SOLIDS = {
	'#': { height: 5.2, material: 'wall' },
	P: { height: 5.2, material: 'pillar' },
	C: { height: 1.9, material: 'crateTall' },
	c: { height: 0.85, material: 'crate' },
	w: { height: 1.05, material: 'barrier' },
};

export const FLOORS = {
	'.': 'yard', A: 'siteA', B: 'siteB', d: 'spawnDef', a: 'spawnAtk', r: 'culvert',
};
export const ROOF_HEIGHT = 3.4;

export const CALLOUTS = {
	atkSpawn: { cell: [19, 28], name: 'Breakroom' },
	yardWest: { cell: [6, 24], name: 'West Yard' },
	yardMid: { cell: [19, 24], name: 'Scale House' },
	yardEast: { cell: [31, 24], name: 'East Yard' },
	aLongLow: { cell: [2, 21], name: 'Brine Long' },
	aLongTop: { cell: [2, 12], name: 'Long Gate' },
	catwalk: { cell: [9, 11], name: 'Catwalk' },
	aShort: { cell: [15, 11], name: 'Kiln Door' },
	midLow: { cell: [19, 19], name: 'Lower Kiln' },
	midHigh: { cell: [19, 9], name: 'Upper Kiln' },
	midDoors: { cell: [19, 5], name: 'Kiln Gate' },
	bLink: { cell: [24, 14], name: 'Pump Link' },
	pumpHall: { cell: [29, 13], name: 'Pump Hall' },
	pumpStairs: { cell: [30, 10], name: 'Pump Stairs' },
	culvertLow: { cell: [36, 22], name: 'Culvert Mouth' },
	culvertHigh: { cell: [36, 11], name: 'Culvert Exit' },
	defSpawn: { cell: [19, 2], name: 'Watch House' },
	aConnector: { cell: [13, 3], name: 'Pan Gate' },
	bConnector: { cell: [26, 3], name: 'Dock Gate' },
	aSite: { cell: [6, 5], name: 'A Pans' },
	bSite: { cell: [33, 5], name: 'B Dock' },
};

export const PLANT_SPOTS = { A: [6, 4], B: [34, 6] };

export const ATTACK_PLANS = [
	{
		id: 'aLong', site: 'A', label: 'A through Brine Long',
		route: ['yardWest', 'aLongLow'], stage: [2, 15], smoke: [6, 8], flash: [3, 9],
		entry: ['aLongTop', 'aSite'], alt: ['yardMid', 'midLow', 'aShort', 'catwalk'],
	},
	{
		id: 'aShort', site: 'A', label: 'A through Catwalk',
		route: ['yardMid', 'midLow', 'aShort'], stage: [14, 11], smoke: [8, 7], flash: [9, 9],
		entry: ['catwalk', 'aSite'], alt: ['yardWest', 'aLongLow', 'aLongTop'],
	},
	{
		id: 'bCulvert', site: 'B', label: 'B through the Culvert',
		route: ['yardEast', 'culvertLow'], stage: [36, 16], smoke: [33, 8], flash: [36, 10],
		entry: ['culvertHigh', 'bSite'], alt: ['yardMid', 'midLow', 'bLink', 'pumpHall'],
	},
	{
		id: 'bPump', site: 'B', label: 'B through Pump Hall',
		route: ['yardMid', 'midLow', 'bLink'], stage: [27, 14], smoke: [31, 7], flash: [30, 9],
		entry: ['pumpStairs', 'bSite'], alt: ['yardEast', 'culvertLow', 'culvertHigh'],
	},
];

export const DEFENSE_POSTS = {
	A: [
		{ at: [6, 7], look: [9, 11] },
		{ at: [3, 6], look: [2, 13] },
		{ at: [10, 3], look: [3, 9] },
	],
	B: [
		{ at: [36, 8], look: [36, 13] },
		{ at: [30, 6], look: [30, 11] },
		{ at: [34, 3], look: [31, 9] },
	],
	mid: [
		{ at: [19, 6], look: [19, 16] },
		{ at: [21, 8], look: [19, 20] },
	],
};

export const POSTPLANT = {
	A: [[9, 2], [2, 9], [10, 8], [4, 2]],
	B: [[37, 2], [29, 8], [37, 9], [28, 2]],
};

export const SIGNS = [
	{ text: 'A', sub: 'EVAPORATION PANS', cell: [6, 0], face: 'south', color: '#e8e2d0' },
	{ text: 'B', sub: 'LOADING DOCK', cell: [33, 0], face: 'south', color: '#e8e2d0' },
	{ text: 'A', sub: 'LONG', cell: [0, 17], face: 'east', color: '#f2a03d' },
	{ text: 'B', sub: 'CULVERT', cell: [39, 23], face: 'west', color: '#f2a03d' },
	{ text: 'KILN', sub: 'MID', cell: [16, 17], face: 'east', color: '#e8e2d0' },
	{ text: 'A', sub: '← CATWALK', cell: [12, 10], face: 'south', color: '#f2a03d' },
	{ text: 'B', sub: 'PUMP →', cell: [23, 16], face: 'west', color: '#f2a03d' },
	{ text: 'SALTGLASS', sub: 'REFINERY · YARD 4', cell: [8, 26], face: 'north', color: '#e8e2d0' },
];

export const LAMPS = [
	[6, 4], [33, 5], [19, 8], [19, 17], [2, 17], [9, 11], [29, 13], [36, 18], [8, 23], [30, 23], [19, 27],
];
