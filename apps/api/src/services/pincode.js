// India Post lookup with a 24h cache and a prefix fallback so the form never blocks.
const STATE_BY_PREFIX = [
  ['11','Delhi'],['12','Haryana'],['13','Haryana'],['14','Punjab'],['15','Punjab'],['16','Punjab'],['17','Himachal Pradesh'],['18','Jammu & Kashmir'],['19','Jammu & Kashmir'],
  ['20','Uttar Pradesh'],['21','Uttar Pradesh'],['22','Uttar Pradesh'],['23','Uttar Pradesh'],['24','Uttar Pradesh'],['25','Uttar Pradesh'],['26','Uttar Pradesh'],['27','Uttar Pradesh'],['28','Uttar Pradesh'],
  ['30','Rajasthan'],['31','Rajasthan'],['32','Rajasthan'],['33','Rajasthan'],['34','Rajasthan'],['36','Gujarat'],['37','Gujarat'],['38','Gujarat'],['39','Gujarat'],
  ['40','Maharashtra'],['41','Maharashtra'],['42','Maharashtra'],['43','Maharashtra'],['44','Maharashtra'],['45','Madhya Pradesh'],['46','Madhya Pradesh'],['47','Madhya Pradesh'],['48','Madhya Pradesh'],['49','Chhattisgarh'],
  ['50','Telangana'],['51','Andhra Pradesh'],['52','Andhra Pradesh'],['53','Andhra Pradesh'],['56','Karnataka'],['57','Karnataka'],['58','Karnataka'],['59','Karnataka'],
  ['60','Tamil Nadu'],['61','Tamil Nadu'],['62','Tamil Nadu'],['63','Tamil Nadu'],['64','Tamil Nadu'],['65','Tamil Nadu'],['66','Tamil Nadu'],['67','Kerala'],['68','Kerala'],['69','Kerala'],
  ['70','West Bengal'],['71','West Bengal'],['72','West Bengal'],['73','West Bengal'],['74','West Bengal'],['75','Odisha'],['76','Odisha'],['77','Odisha'],['78','Assam'],['79','North East'],
  ['80','Bihar'],['81','Bihar'],['82','Jharkhand'],['83','Jharkhand'],['84','Bihar'],['85','Bihar'],
];
const CITY_BY_PREFIX = { 600:'Chennai',620:'Tiruchirappalli',625:'Madurai',636:'Salem',638:'Erode',641:'Coimbatore',642:'Pollachi',643:'Nilgiris',560:'Bengaluru',400:'Mumbai',110:'New Delhi',500:'Hyderabad',682:'Ernakulam',695:'Thiruvananthapuram',700:'Kolkata',411:'Pune',380:'Ahmedabad' };

const cache = new Map();
export async function lookupPincode(pin) {
  pin = String(pin).trim();
  if (!/^[1-9]\d{5}$/.test(pin)) return { valid: false };
  const c = cache.get(pin);
  if (c && Date.now() - c.at < 86400e3) return c.v;
  const fallback = { valid: true, pincode: pin, city: CITY_BY_PREFIX[pin.slice(0, 3)] || '', state: STATE_BY_PREFIX.find(([p]) => pin.startsWith(p))?.[1] || '', areas: [], source: 'offline' };
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: ctrl.signal });
    clearTimeout(t);
    const data = await res.json();
    const block = Array.isArray(data) ? data[0] : null;
    let v = fallback;
    if (block?.Status === 'Success' && block.PostOffice?.length) {
      const po = block.PostOffice[0];
      v = { valid: true, pincode: pin, city: po.District, state: po.State, areas: block.PostOffice.map((x) => x.Name).slice(0, 20), source: 'india-post' };
    } else if (block?.Status === 'Error') v = { ...fallback, valid: false };
    cache.set(pin, { at: Date.now(), v });
    return v;
  } catch { return fallback; }
}
