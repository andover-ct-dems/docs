// Seat data for each chamber. Everything in seat.html and wall.html is driven from here.
//
//   total    number of seats
//   rBefore  districts held by Republicans going into the election (all others were Democratic)
//   flips    districts that changed party: { district: { name: 'Winner', to: 'D' or 'R' } }
//   dAfter / rAfter are derived; the console warns if they don't add up.
//
// To add the Senate, fill in the `senate` entry in the same shape (total: 36).
window.CHAMBERS = {
  house: {
    name: 'House',
    total: 151,
    rBefore: [8, 14, 23, 30, 32, 34, 35, 43, 44, 45, 47, 48, 51, 52, 53, 55, 59, 61, 62, 63, 65, 66, 67, 68, 69, 70, 71,
      76, 77, 78, 80, 86, 87, 89, 90, 99, 105, 106, 107, 108, 112, 113, 119, 122, 123, 125, 131, 141, 149],
    flips: {
      8: { name: 'Francis Lombard', to: 'D' },
      23: { name: 'Jane Wisialowski', to: 'D' },
      35: { name: 'Cinzia Lettieri', to: 'D' },
      43: { name: 'Bill Heughins', to: 'D' },
      48: { name: 'Bob Fernandez', to: 'D', pending: true },      // recount: state confirmation still pending as of Nov. 14
      55: { name: 'Ellen Paul', to: 'D' },
      59: { name: 'Rick LeBorious', to: 'D' },
      62: { name: 'Kim Becker', to: 'D' },
      77: { name: 'DeWayne K. Wynn Jr.', to: 'D' },
      90: { name: 'David J. Fritz', to: 'D' },
      106: { name: 'Michelle Embree Ku', to: 'D' },
      107: { name: 'Julie Kerton', to: 'D' },
      113: { name: 'Bryan Lizotte', to: 'D' },
      122: { name: 'Mandy Kilmartin', to: 'D' },
    },
  },
  senate: {
    name: 'Senate',
    total: 36,
    rBefore: [7, 16, 18, 21, 28, 30, 31, 32, 34, 35, 36],
    flips: {
      7: { name: 'David Kiner', to: 'D' },
      18: { name: 'Joe de la Cruz', to: 'D' },
      21: { name: 'Carolann Reid', to: 'D' },
      28: { name: 'Rob Blanchard', to: 'D' },
      30: { name: 'Aaron Zimmer', to: 'D' },
      34: { name: 'Brandi Mandato', to: 'D' },
      35: { name: 'Ethan Werstler', to: 'D' },
      36: { name: 'Jill Oberlander', to: 'D' },
    },
  },
};

function seatBefore(ch, n) { return ch.rBefore.includes(n) ? 'R' : 'D'; }
function seatAfter(ch, n) { return ch.flips[n] ? ch.flips[n].to : seatBefore(ch, n); }
function flipList(ch) { return Object.keys(ch.flips).map(Number).sort((a, b) => a - b); }
function seatCounts(ch) {
  const rB = ch.rBefore.length;
  let rA = rB;
  for (const n of flipList(ch)) rA += ch.flips[n].to === 'R' ? 1 : -1;
  return { dBefore: ch.total - rB, rBefore: rB, dAfter: ch.total - rA, rAfter: rA };
}
for (const [key, ch] of Object.entries(window.CHAMBERS)) {
  if (!ch) continue;
  for (const n of flipList(ch))
    if (seatBefore(ch, n) === ch.flips[n].to) console.warn(`${key} ${n}: listed as a flip but the party does not change`);
}
