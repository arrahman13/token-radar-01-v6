

                                   
               
               
                          
                   
                  
                           
                          
                           
                          
                        
 

                           
                
                 
                    
                                
                      
 

const VALUE_TERMS           = ['size', 'size3', 'growth_age', 'size_growth'];

const ODDS_TERMS           = ['age_yrs', 'category_offset'];

const MODEL_VERSION = 'radar-6';

const HUBER_K = 1.345;

const CAT_SHRINK_K = 5;

const CAPTURE_SHARE = 0.00001;

const LIVE_ROWS = 24;

                           
               
               
               
 

                           
               
               
               
                          
                   
                  
                           
                          
                           
                          
                        
                            
                       
                        
                          
                            
                           
                            
                     
          
                 
                  
                       
                        
                      
    
         
                  
                           
                        
                      
                          
                  
                               
                             
                                  
    
                       
 

                           
               
               
               
                          
                   
                  
                           
                           
                          
                       
                        
                            
                           
                            
                     
                         
                       
 

                          
               
               
                          
                   
                  
                          
                           
 

                                   
               
               
                                                  
                 
 

                             
                     
                       
             
               
 

                            
                
                 
                    
                        
                        
                       
                        
                       
                       
                     
                        
                        
                         
                                                
                             
                           
                             
                               
                              
                
                
                          
                         
                         
                     
                    
                    
                   
                  
                                  
                                             
                                    
                     
                   
 

class SnapshotError extends Error {
  constructor(message        ) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

function finite(value         , fallback        )         {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function ageDays(asOf        , listedAt               )                {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

function mulberry32(seed        )               {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(n        , seed        )           {
  const rand = mulberry32(seed);
  const arr           = [];
  for (let i = 0; i < n; i++) arr.push(i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = arr[i] ;
    arr[i] = arr[j] ;
    arr[j] = t;
  }
  return arr;
}

function kFolds(idx          , k        )             {
  const folds             = [];
  for (let f = 0; f < k; f++) folds.push([]);
  idx.forEach((v, i) => folds[i % k] .push(v));
  return folds;
}

function solveLinear(aIn            , bIn          )           {
  const n = bIn.length;
  const a             = aIn.map((row) => row.slice());
  const b           = bIn.slice();
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r] [col] ) > Math.abs(a[piv] [col] )) piv = r;
    const tmpRow = a[col] ;
    a[col] = a[piv] ;
    a[piv] = tmpRow;
    const tmpB = b[col] ;
    b[col] = b[piv] ;
    b[piv] = tmpB;
    const pivot = a[col] [col] ;
    if (Math.abs(pivot) < 1e-12) continue;
    for (let r = col + 1; r < n; r++) {
      const factor = a[r] [col]  / pivot;
      if (factor === 0) continue;
      for (let c = col; c < n; c++) a[r] [c] = a[r] [c]  - factor * a[col] [c] ;
      b[r] = b[r]  - factor * b[col] ;
    }
  }
  const x           = new Array        (n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i] ;
    for (let j = i + 1; j < n; j++) sum -= a[i] [j]  * x[j] ;
    x[i] = Math.abs(a[i] [i] ) < 1e-12 ? 0 : sum / a[i] [i] ;
  }
  return x;
}

function wls(x            , y          , w          , ridge        )           {
  const p = x[0] .length;
  const a             = [];
  const bvec           = [];
  for (let i = 0; i < p; i++) {
    a.push(new Array        (p).fill(0));
    bvec.push(0);
  }
  for (let r = 0; r < x.length; r++) {
    const wr = w[r] ;
    for (let i = 0; i < p; i++) {
      bvec[i] = bvec[i]  + wr * x[r] [i]  * y[r] ;
      for (let j = 0; j < p; j++) a[i] [j] = a[i] [j]  + wr * x[r] [i]  * x[r] [j] ;
    }
  }
  for (let i = 0; i < p; i++) a[i] [i] = a[i] [i]  + ridge;
  return solveLinear(a, bvec);
}

function dot(a          , b          )         {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]  * b[i] ;
  return s;
}

function ols(x            , y          )           {
  const p = x[0] .length;
  const a             = [];
  const b           = [];
  for (let i = 0; i < p; i++) {
    a.push(new Array        (p).fill(0));
    b.push(0);
  }
  for (let r = 0; r < x.length; r++) {
    for (let i = 0; i < p; i++) {
      b[i] = b[i]  + x[r] [i]  * y[r] ;
      for (let j = 0; j < p; j++) a[i] [j] = a[i] [j]  + x[r] [i]  * x[r] [j] ;
    }
  }
  for (let i = 0; i < p; i++) a[i] [i] = a[i] [i]  + (i > 0 ? 1e-8 : 0);
  return solveLinear(a, b);
}

function huberFit(x            , y          , k         = HUBER_K)           {
  const p = x[0] .length;
  let beta = ols(x, y);
  for (let it = 0; it < 30; it++) {
    const resid = y.map((yi, r) => yi - dot(x[r] , beta));
    const s = median(resid.map((r) => Math.abs(r))) / 0.6745 + 1e-9;
    const kk = k * s;
    const w = resid.map((r) => (Math.abs(r) <= kk ? 1 : kk / Math.max(Math.abs(r), 1e-9)));
    const sw = w.map((v) => Math.sqrt(v));
    const xw = x.map((row, r) => row.map((v) => v * sw[r] ));
    const yw = y.map((v, r) => v * sw[r] );
    const next = ols(xw, yw);
    let delta = 0;
    for (let j = 0; j < p; j++) delta = Math.max(delta, Math.abs(next[j]  - beta[j] ));
    beta = next;
    if (delta < 1e-9) break;
  }
  return beta;
}

function logitFit(x            , y          )           {
  const p = x[0] .length;
  let beta           = new Array        (p).fill(0);
  for (let iter = 0; iter < 100; iter++) {
    const g           = new Array        (p).fill(0);
    const h             = [];
    for (let i = 0; i < p; i++) h.push(new Array        (p).fill(0));
    for (let r = 0; r < x.length; r++) {
      let z = 0;
      for (let j = 0; j < p; j++) z += x[r] [j]  * beta[j] ;
      const pr = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
      const w = Math.max(pr * (1 - pr), 1e-9);
      const d = y[r]  - pr;
      for (let i = 0; i < p; i++) {
        g[i] = g[i]  + x[r] [i]  * d;
        for (let j = 0; j < p; j++) h[i] [j] = h[i] [j]  + w * x[r] [i]  * x[r] [j] ;
      }
    }
    for (let i = 0; i < p; i++) h[i] [i] = h[i] [i]  + 1e-8;
    const step = solveLinear(h, g);
    let delta = 0;
    for (let j = 0; j < p; j++) {
      beta[j] = beta[j]  + step[j] ;
      delta = Math.max(delta, Math.abs(step[j] ));
    }
    if (delta < 1e-10) break;
  }
  return beta;
}

function median(values          )         {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]  : (sorted[mid - 1]  + sorted[mid] ) / 2;
}

function mean(values          )         {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const round4 = (n        )         => Math.round(n * 1e4) / 1e4;
const round2 = (n        )         => Math.round(n * 100) / 100;

function clamp(x        , lo        , hi        )         {
  return Math.min(hi, Math.max(lo, x));
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

const EXCLUDED_CATEGORIES           = ['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX'];

const EXCHANGE_PREFIXES           = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

const BANNED_WORDS           = ['wrapped', 'staked', 'staking'];

function isPreToken(p                  )          {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

function exclusionReason(p                  )                {
  if (!isPreToken(p)) return 'records a token';
  if (VERSIONED.test(p.name)) return 'versioned name';
  if (p.category !== null && EXCLUDED_CATEGORIES.includes(p.category)) return `category ${p.category}`;
  const lower = p.name.toLowerCase();
  for (const w of BANNED_WORDS) {
    if (new RegExp(`\\b${w}\\b`).test(lower)) return 'wrapped or staked product';
  }
  for (const e of EXCHANGE_PREFIXES) {
    if (p.name.startsWith(e)) return 'exchange-prefixed name';
  }
  return null;
}

function isRankable(p                  )          {
  return exclusionReason(p) === null;
}

function bySlug(protocols                    )                                {
  return new Map(protocols.map((p) => [p.slug, p]));
}

                        
            
               
                
                    
                     
                   
                            
 

                           
                  
                      
                    
                       
                       
                       
                                           
                         
                           
                          
                            
                
 

function valuePeers(snapshot          )                                                                                                                                                                                             {
  const peers = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd >= 5_000_000);
  const lnTvl = peers.map((p) => Math.log(p.tvl_usd));
  const ageLogs = peers
    .map((p) => ageDays(snapshot.as_of, p.listed_at))
    .filter((a)              => a !== null)
    .map((a) => Math.log(a + 1));
  const medianAge = median(ageLogs);
  const ageC = peers.map((p) => {
    const a = ageDays(snapshot.as_of, p.listed_at);
    return a === null ? medianAge : Math.log(a + 1);
  });
  const growth = peers.map((p) => clamp(p.change_7d === null ? 0 : p.change_7d, -50, 50) / 50);
  const chainsC = peers.map((p) => Math.log1p(p.chains.length));
  const centers = {
    lnTvl: mean(lnTvl),
    age: mean(ageC),
    growth: mean(growth),
    chains: mean(chainsC),
    medianAge,
  };
  const feats                 = peers.map((p, i) => {
    const L = lnTvl[i]  - centers.lnTvl;
    const A = ageC[i]  - centers.age;
    const G = growth[i]  - centers.growth;
    return {
      y: Math.log(p.mcap_usd  / p.tvl_usd),
      size: L,
      size3: L * L * L,
      growthAge: G * A,
      sizeGrowth: L * G,
      category: p.category ?? 'None',
      listedDays: ageDays(snapshot.as_of, p.listed_at),
    };
  });
  const ranges                                   = {};
  for (const t of ['size', 'size3', 'growth_age', 'size_growth']         ) {
    const col = feats.map((f) => (t === 'size' ? f.size : t === 'size3' ? f.size3 : t === 'growth_age' ? f.growthAge : f.sizeGrowth));
    ranges[t] = [Math.min(...col), Math.max(...col)];
  }
  return { peers, feats, centers, ranges };
}

function valueRow(f              )           {
  return [1, f.size, f.size3, f.growthAge, f.sizeGrowth];
}

function valueTermsFor(p                  , asOf        , fit          )                                                                         {
  const L = Math.log(p.tvl_usd) - fit.centerLnTvl;
  const a = ageDays(asOf, p.listed_at);
  const age = (a === null ? fit.medianAgeLog : Math.log(a + 1)) - fit.centerAge;
  const g = clamp(p.change_7d === null ? 0 : p.change_7d, -50, 50) / 50 - fit.centerGrowth;
  const clampTerm = (term        , v        )         => {
    const r = fit.ranges[term];
    return r === undefined ? v : clamp(v, r[0], r[1]);
  };
  return {
    size: clampTerm('size', L),
    size3: clampTerm('size3', L * L * L),
    growthAge: clampTerm('growth_age', g * age),
    sizeGrowth: clampTerm('size_growth', L * g),
  };
}

function errorFactor(resid          )         {
  return Math.exp(mean(resid.map((v) => Math.abs(v))));
}

function fitValueModel(snapshot          )           {
  const { feats, centers, ranges } = valuePeers(snapshot);
  const n = feats.length;
  const xAll = feats.map(valueRow);
  const yAll = feats.map((f) => f.y);
  const coefs = huberFit(xAll, yAll);
  const pred = (b          , i        )         => dot(xAll[i] , b);

  
  const looResid           = [];
  for (let i = 0; i < n; i++) {
    const xi             = [];
    const yi           = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      xi.push(xAll[j] );
      yi.push(yAll[j] );
    }
    const b = huberFit(xi, yi);
    looResid.push(yAll[i]  - pred(b, i));
  }
  const loo = errorFactor(looResid);

  
  
  const datedIdx           = [];
  feats.forEach((f, i) => {
    if (f.listedDays !== null) datedIdx.push(i);
  });
  datedIdx.sort((a, b) => feats[b] .listedDays  - feats[a] .listedDays );
  const wfResid           = [];
  for (const frac of [0.5, 0.6, 0.7]) {
    const cut = Math.floor(datedIdx.length * frac);
    const test = datedIdx.slice(cut, cut + Math.max(1, Math.floor(datedIdx.length * 0.2)));
    const train = datedIdx.slice(0, cut);
    const b = huberFit(train.map((i) => xAll[i] ), train.map((i) => yAll[i] ));
    for (const i of test) {
      wfResid.push(yAll[i]  - pred(b, i));
    }
  }
  const wf = errorFactor(wfResid);

  
  const cvResid           = [];
  for (let rep = 0; rep < 3; rep++) {
    const perm = shuffled(n, 11 + rep);
    const folds = kFolds(perm, 10);
    for (const fold of folds) {
      const inFold = new Set(fold);
      const train           = [];
      for (let i = 0; i < n; i++) if (!inFold.has(i)) train.push(i);
      const b = huberFit(train.map((i) => xAll[i] ), train.map((i) => yAll[i] ));
      for (const i of fold) {
        cvResid.push(yAll[i]  - pred(b, i));
      }
    }
  }
  const cv = errorFactor(cvResid);

  
  const locoResid           = [];
  const cats = [...new Set(feats.map((f) => f.category))];
  for (const c of cats) {
    const test           = [];
    const train           = [];
    feats.forEach((f, i) => (f.category === c ? test.push(i) : train.push(i)));
    if (test.length === 0 || train.length < 5) continue;
    const b = huberFit(train.map((i) => xAll[i] ), train.map((i) => yAll[i] ));
    for (const i of test) {
      locoResid.push(yAll[i]  - pred(b, i));
    }
  }
  const loco = errorFactor(locoResid);

  
  const oof           = new Array        (n).fill(0);
  const perm = shuffled(n, 11);
  for (const fold of kFolds(perm, 10)) {
    const inFold = new Set(fold);
    const train           = [];
    for (let i = 0; i < n; i++) if (!inFold.has(i)) train.push(i);
    const b = huberFit(train.map((i) => xAll[i] ), train.map((i) => yAll[i] ));
    for (const i of fold) {
      oof[i] = yAll[i]  - pred(b, i);
    }
  }
  const absOof = oof.map((v) => Math.abs(v)).sort((a, b) => a - b);
  const qIndex = Math.min(n - 1, Math.ceil(((n + 1) * 0.8) / n * n) - 1);
  const half = absOof[Math.max(0, qIndex)] ;
  const coverage = mean(oof.map((v) => (Math.abs(v) <= half ? 1 : 0)));

  return {
    coefs,
    centerLnTvl: centers.lnTvl,
    centerAge: centers.age,
    centerGrowth: centers.growth,
    centerChains: centers.chains,
    medianAgeLog: centers.medianAge,
    ranges,
    validation: { loo, walk_forward: wf, cv, loco },
    conformalHalfLog: half,
    conformalFactor: Math.exp(half),
    conformalCoverage: coverage,
    peers: n,
  };
}

                          
                  
                         
                
                   
                       
                                          
 

function categoryOffsets(dated                    , y          , trainIdx          , k        )                      {
  const base = mean(trainIdx.map((i) => y[i] ));
  const baseLogit = Math.log(base / (1 - base));
  const byCat = new Map                  ();
  for (const i of trainIdx) {
    const c = dated[i] .category ?? 'None';
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c) .push(i);
  }
  const out = new Map                ();
  for (const [c, idx] of byCat) {
    const pc = (idx.reduce((s, i) => s + y[i] , 0) + k * base) / (idx.length + k);
    out.set(c, Math.log(pc / (1 - pc)) - baseLogit);
  }
  return out;
}

function fitOddsModel(snapshot          )          {
  const dated = snapshot.protocols.filter((p) => p.listed_at !== null);
  const n = dated.length;
  const y = dated.map((p) => (isPreToken(p) ? 0 : 1));
  const baseRate = mean(y);
  const ages = dated.map((p) => ageDays(snapshot.as_of, p.listed_at)  / 365.25);
  const medianAgeYrs = median(ages);
  const allIdx           = [];
  for (let i = 0; i < n; i++) allIdx.push(i);
  const offsets = categoryOffsets(dated, y, allIdx, CAT_SHRINK_K);
  const design = (idx          , off                     )             =>
    idx.map((i) => [1, ages[i] , off.get(dated[i] .category ?? 'None') ?? 0]);
  const coefs = logitFit(design(allIdx, offsets), allIdx.map((i) => y[i] ));

  const predict = (b          , row          )         => {
    const z = b[0]  + b[1]  * row[1]  + b[2]  * row[2] ;
    return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
  };
  const brier = (pred          , truth          )         => mean(pred.map((p, i) => (p - truth[i] ) * (p - truth[i] )));

  
  const cvScores           = [];
  for (let rep = 0; rep < 3; rep++) {
    const perm = shuffled(n, 23 + rep);
    for (const fold of kFolds(perm, 10)) {
      const inFold = new Set(fold);
      const train           = [];
      for (let i = 0; i < n; i++) if (!inFold.has(i)) train.push(i);
      const off = categoryOffsets(dated, y, train, CAT_SHRINK_K);
      const b = logitFit(design(train, off), train.map((i) => y[i] ));
      cvScores.push(brier(fold.map((i) => predict(b, design([i], off)[0] )), fold.map((i) => y[i] )));
    }
  }
  const cv = mean(cvScores);

  
  const order = dated.map((p, i) => i).sort((a, b) => ageDays(snapshot.as_of, dated[b] .listed_at)  - ageDays(snapshot.as_of, dated[a] .listed_at) );
  const wfScores           = [];
  for (const frac of [0.5, 0.6, 0.7]) {
    const cut = Math.floor(n * frac);
    const test = order.slice(cut, cut + Math.max(1, Math.floor(n * 0.2)));
    const train = order.slice(0, cut);
    const off = categoryOffsets(dated, y, train, CAT_SHRINK_K);
    const b = logitFit(design(train, off), train.map((i) => y[i] ));
    wfScores.push(brier(test.map((i) => predict(b, design([i], off)[0] )), test.map((i) => y[i] )));
  }
  const wf = mean(wfScores);

  
  const locoScores           = [];
  const cats = [...new Set(dated.map((p) => p.category ?? 'None'))];
  for (const c of cats) {
    const test           = [];
    const train           = [];
    dated.forEach((p, i) => ((p.category ?? 'None') === c ? test.push(i) : train.push(i)));
    if (test.length === 0 || train.length < 10) continue;
    const off = categoryOffsets(dated, y, train, CAT_SHRINK_K);
    const b = logitFit(design(train, off), train.map((i) => y[i] ));
    locoScores.push(brier(test.map((i) => predict(b, design([i], off)[0] )), test.map((i) => y[i] )));
  }
  const loco = mean(locoScores);

  const offsetsObj                         = {};
  for (const [c, v] of offsets) offsetsObj[c] = round4(v);
  return {
    coefs,
    validation: { loo: NaN, walk_forward: wf, cv, loco },
    dated: n,
    baseRate,
    medianAgeYrs,
    categoryOffsets: offsetsObj,
  };
}

function tokenOdds(p                  , asOf        , fit         )         {
  const age = ageDays(asOf, p.listed_at);
  const ageYrs = age === null ? fit.medianAgeYrs : age / 365.25;
  const off = fit.categoryOffsets[p.category ?? 'None'] ?? 0;
  const z = fit.coefs[0]  + fit.coefs[1]  * ageYrs + fit.coefs[2]  * off;
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
}

const GAS_TABLE                         = {
  Ethereum: 4.0,
  Arbitrum: 0.1,
  Base: 0.05,
  Optimism: 0.1,
  Binance: 0.15,
  Solana: 0.02,
  Polygon: 0.05,
  Avalanche: 0.3,
  'Hyperliquid L1': 0.05,
};
const GAS_DEFAULT_USD = 0.5;

function gasPerTx(p                  )         {
  const chain = p.chains.length > 0 ? p.chains[0]  : 'Ethereum';
  return GAS_TABLE[chain] ?? GAS_DEFAULT_USD;
}

function capitalFor(p                  )         {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

function holdDaysFor(age               )         {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

function actionFor(p                  , capital        , chain        )         {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

function stepText(step          )         {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

function farmEconomics(
  p                  ,
  age               ,
  implied        ,
  odds        ,
)                   {
  const chain = p.chains.length > 0 ? p.chains[0]  : 'Ethereum';
  const gasPerTxUsd = gasPerTx(p);
  const capital = capitalFor(p);
  const holdDays = holdDaysFor(age);
  const weeks = Math.ceil(holdDays / 7);
  
  const gasTotal = round2((3 + weeks + 1) * gasPerTxUsd);
  const hours = round2(0.5 + weeks * (10 / 60) + 0.25);
  
  
  
  const expectedGross = implied * CAPTURE_SHARE;
  const netPerHour = round2((expectedGross - gasTotal) / hours);
  const breakeven = (gasTotal / Math.max(implied, 1)) * 100;
  return {
    chain,
    gas_per_tx_usd: gasPerTxUsd,
    capital_usd: capital,
    hold_days: holdDays,
    gas_total_usd: gasTotal,
    hours,
    expected_gross_usd: round2(expectedGross),
    net_per_hour_usd: netPerHour,
    breakeven_capture_pct: round4(breakeven),
  };
}

function fmtBreakeven(pct        )         {
  return pct < 0.0001 ? '<0.0001%' : `${pct.toFixed(4)}%`;
}

function farmSteps(p                  , age               , farm                  , odds        )             {
  const chain = farm.chain;
  const capital = farm.capital_usd;
  const hold = farm.hold_days;
  const action = actionFor(p, capital, chain);
  const be = fmtBreakeven(farm.breakeven_capture_pct);
  const verdict =
    farm.net_per_hour_usd >= 0
      ? `Verdict: net $${farm.net_per_hour_usd.toFixed(2)} an hour after gas on ${chain} at the planning capture share, so this farm pays for its gas when it captures at least ${be} of the modelled value.`
      : `Verdict: net $${farm.net_per_hour_usd.toFixed(2)} an hour after gas on ${chain} at the planning capture share, so this farm loses money unless it captures at least ${be} of the modelled value.`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `about $${farm.gas_per_tx_usd.toFixed(2)} of gas on ${chain} for the first transaction`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital (the minimum viable position for this protocol) and about $${(3 * farm.gas_per_tx_usd).toFixed(2)} of gas for the setup transactions on ${chain}`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: `about $${farm.gas_per_tx_usd.toFixed(2)} of gas a week on ${chain}`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: verdict,
      cost: `$${farm.gas_total_usd.toFixed(2)} of gas in total on ${chain} against $${farm.expected_gross_usd.toFixed(2)} of expected gross at the planning capture share (token odds ${(odds * 100).toFixed(1)}% already in the modelled value)`,
      time: `${farm.hours.toFixed(2)} hours of attention in total`,
    },
  ];
}

function impliedValue(p                  , asOf        , fit          , odds        )                                                                                                              {
  const t = valueTermsFor(p, asOf, fit);
  const logRatio = fit.coefs[0]  + fit.coefs[1]  * t.size + fit.coefs[2]  * t.size3 + fit.coefs[3]  * t.growthAge + fit.coefs[4]  * t.sizeGrowth;
  const implied = Math.max(1, Math.round(Math.exp(logRatio) * p.tvl_usd * odds));
  return { implied, size: round4(t.size), size3: round4(t.size3), growth_age: round4(t.growthAge), size_growth: round4(t.sizeGrowth), logRatio: round4(logRatio) };
}

function buildBoard(snapshot          , valueFit          , oddsFit         )             {
  const index = bySlug(snapshot.protocols);
  const watchSet = new Set(snapshot.watchlist);
  const chosen = new Map                          ();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    
    
    const odds = round4(tokenOdds(p, snapshot.as_of, oddsFit));
    const { implied, size, size3, growth_age, size_growth, logRatio } = impliedValue(p, snapshot.as_of, valueFit, odds);
    const farm = farmEconomics(p, age, implied, odds);
    const low = Math.max(1, Math.round(implied / valueFit.conformalFactor));
    const high = Math.round(implied * valueFit.conformalFactor);
    return { p, age, implied, size, size3, growth_age, size_growth, logRatio, odds, farm, low, high };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    above_floor: s.p.tvl_usd >= snapshot.floor_usd,
    on_watchlist: watchSet.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    interval_low_usd: s.low,
    interval_high_usd: s.high,
    token_odds: round4(s.odds),
    model: { size: s.size, size3: s.size3, growth_age: s.growth_age, size_growth: s.size_growth, log_ratio: s.logRatio },
    farm: s.farm,
    farm_steps: farmSteps(s.p, s.age, s.farm, s.odds).map(stepText),
  }));
}

function liveRows(snapshot          )            {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

function disposition(snapshot          , board            , live           )                     {
  const boardSlugs = new Set(board.map((r) => r.slug));
  const liveSlugs = new Set(live.map((r) => r.slug));
  const out                     = snapshot.protocols.map((p) => {
    if (boardSlugs.has(p.slug)) return { slug: p.slug, name: p.name, status: 'board', reason: 'ranked on the board' };
    if (liveSlugs.has(p.slug)) return { slug: p.slug, name: p.name, status: 'live', reason: 'already trades; market value shown, not ranked' };
    if (!isPreToken(p)) return { slug: p.slug, name: p.name, status: 'token', reason: 'records a token; market value, not a launch to farm' };
    return { slug: p.slug, name: p.name, status: 'excluded', reason: exclusionReason(p) ?? 'excluded' };
  });
  out.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return out;
}

function radarRow(row          )           {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    above_floor: row.above_floor,
    on_watchlist: row.on_watchlist,
    implied_value_usd: row.implied_value_usd,
    interval_low_usd: row.interval_low_usd,
    interval_high_usd: row.interval_high_usd,
    token_odds: row.token_odds,
    farm: row.farm,
    farm_steps: row.farm_steps,
  };
}

function buildRadar(snapshot          )                                          {
  const valueFit = fitValueModel(snapshot);
  const oddsFit = fitOddsModel(snapshot);
  const board = buildBoard(snapshot, valueFit, oddsFit);
  const live = liveRows(snapshot);
  const disp = disposition(snapshot, board, live);
  const counts                         = { board: 0, live: 0, token: 0, excluded: 0 };
  for (const d of disp) counts[d.status] = (counts[d.status] ?? 0) + 1;
  const checksum = sha256Hex(canonicalJson(board.map((r) => ({ rank: r.rank, slug: r.slug, implied_value_usd: r.implied_value_usd }))));
  const radar            = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    value_terms: VALUE_TERMS,
    odds_terms: ODDS_TERMS,
    value_coefs: valueFit.coefs.map(round4),
    odds_coefs: oddsFit.coefs.map(round4),
    center_lntvl: round4(valueFit.centerLnTvl),
    center_age: round4(valueFit.centerAge),
    center_growth: round4(valueFit.centerGrowth),
    center_chains: round4(valueFit.centerChains),
    median_age_log: round4(valueFit.medianAgeLog),
    term_ranges: {
      size: valueFit.ranges.size .map(round4),
      size3: valueFit.ranges.size3 .map(round4),
      growth_age: valueFit.ranges.growth_age .map(round4),
      size_growth: valueFit.ranges.size_growth .map(round4),
    },
    conformal_half_log: round4(valueFit.conformalHalfLog),
    conformal_factor: round4(valueFit.conformalFactor),
    conformal_coverage: round4(valueFit.conformalCoverage),
    value_validation: {
      loo: round4(valueFit.validation.loo),
      walk_forward: round4(valueFit.validation.walk_forward),
      cv: round4(valueFit.validation.cv),
      loco: round4(valueFit.validation.loco),
    },
    odds_validation: {
      loo: null,
      walk_forward: round4(oddsFit.validation.walk_forward),
      cv: round4(oddsFit.validation.cv),
      loco: round4(oddsFit.validation.loco),
    },
    peers: valueFit.peers,
    dated: oddsFit.dated,
    token_base_rate: round4(oddsFit.baseRate),
    median_age_yrs: round4(oddsFit.medianAgeYrs),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    live_size: live.length,
    accounted: disp.length,
    rows: board.map(radarRow),
    live,
    disposition: disp,
    disposition_counts: counts,
    gas_table: GAS_TABLE,
    snapshot,
    checksum,
  };
  return { board, radar };
}

function parseSnapshot(text        )           {
  let raw         ;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw                           ;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v                           ;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c)              => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist            ,
  };
}

function boardIssue(board            , snapshot          )                {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i] .implied_value_usd > board[i - 1] .implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0] .implied_value_usd === board[board.length - 1] .implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0] .implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

function dataScript(radar           )         {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

function canonicalJson(value         )         {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`canonicalJson: ${value} is not a finite number`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  if (typeof value === 'object') {
    const o = value                           ;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(',')}}`;
  }
  throw new TypeError(`canonicalJson: a ${typeof value} has no JSON form`);
}

const SHA_K           = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function sha256Hex(text        )         {
  const bytes = new TextEncoder().encode(text);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const msg = new Uint8Array(paddedLen);
  msg.set(bytes);
  msg[bytes.length] = 0x80;
  const view = new DataView(msg.buffer);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 4294967296), false);
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const rotr = (x        , n        )         => (x >>> n) | (x << (32 - n));
  const w = new Array        (64).fill(0);
  for (let block = 0; block < paddedLen; block += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(block + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15] , 7) ^ rotr(w[t - 15] , 18) ^ (w[t - 15]  >>> 3);
      const s1 = rotr(w[t - 2] , 17) ^ rotr(w[t - 2] , 19) ^ (w[t - 2]  >>> 10);
      w[t] = (w[t - 16]  + s0 + w[t - 7]  + s1) | 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let t = 0; t < 64; t++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + s1 + ch + SHA_K[t]  + w[t] ) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }
  const hex = (x        )         => (x >>> 0).toString(16).padStart(8, '0');
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7);
}

function rebuildBoard(snapshot          )                                                                                          {
  const valueFit = fitValueModel(snapshot);
  const oddsFit = fitOddsModel(snapshot);
  const board = buildBoard(snapshot, valueFit, oddsFit);
  const rows = board.map((r) => ({ rank: r.rank, slug: r.slug, implied_value_usd: r.implied_value_usd }));
  return { rows, checksum: sha256Hex(canonicalJson(rows)) };
}

window.RADAR_MODEL = { rebuildBoard, sha256Hex, canonicalJson, impliedValue, tokenOdds, fitValueModel, fitOddsModel };
