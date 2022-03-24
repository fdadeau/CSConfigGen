/***
 * Module computing:
 *    - the complexity of a configuration
 *    - the score of the parameters
 *    - the clustering using KMeans algorithm parameterized by a distance function
 */

const C3_LA = 1;
const C3_CE = 0.4;


function isHierarchical(config, parent) {
    for (let CType in config) {
        for (let id in config[CType]) {
            if (config[CType][id]._parent != null) {
                return true;
            }    
        }
    }
    return false;
}

/**
 * Computation of complexity 
 */
function complexity(config, parent, alpha, icc) {
    let c3 = isHierarchical(config, parent) ? C3_LA : C3_CE;
    let c = 0;
    // sum of complexities (formula (2) in the paper)
    for (let CType in config) {
        for (let id in config[CType]) {
            if (config[CType][id]._parent == null) {
                let complx = C(config, id, alpha, icc, c3);
                c += complx;
            }
        }
    }
    return c;
}

function C(config, id, alpha, icc, C3) {
    let c1 = C1(config, id, alpha);
    let c2 = C2(config, id, alpha, icc);    
    return c1 + c2 * C3;
}

function C1(config, id, alpha) {
    let ret = 0;
    for (let CType in config) {
        for (let _id in config[CType]) {
            if (id == _id || config[CType][_id]._parent == id) {
                ret += alpha[CType];
            }
        }
    }
    return ret;
}

function C2(config, id, alpha, icc) {
    let c2 = 0;

    let component = getComponent(config, id);
    let CType = component._ctype;

    for (let interface1 in component._bindings) {
        if (isInterface(component._bindings[interface1])) {
            let CType2 = getComponentIn(component._bindings[interface1][0], config)._ctype;
            let interface2 = component._bindings[interface1][0].split(",")[1].trim();
            if (icc[`${interface1},${interface2}`]) {
                c2 += component._bindings[interface1].length * icc[`${interface1},${interface2}`] * (alpha[CType] + alpha[CType2])/2;
            }
            else if (icc[`${interface2},${interface1}`]) {
                c2 += component._bindings[interface1].length * icc[`${interface2},${interface1}`] * (alpha[CType] + alpha[CType2])/2;
            }
        }
    }
    for (let interface1 in component._delegProv) {
        if (isInterface(component._delegProv[interface1])) {
            let CType2 = getComponentIn(component._delegProv[interface1][0], config)._ctype;
            let interface2 = component._delegProv[interface1][0].split(",")[1].trim();
            if (icc[`${interface1},${interface2}`]) {
                c2 += icc[`${interface1},${interface2}`] * (alpha[CType] + alpha[CType2])/2;
            }
            else if (icc[`${interface2},${interface1}`]) {
                c2 += component._bindings[interface1].length * icc[`${interface2},${interface1}`] * (alpha[CType] + alpha[CType2])/2;
            }
        }
    }
    for (let interface1 in component._delegReq) {
        if (isInterface(component._delegReq[interface1])) {
            let CType2 = getComponentIn(component._delegProv[interface1][0], config)._ctype;
            let interface2 = component._delegReq[interface1][0].split(",")[1].trim();
            if (icc[`${interface1},${interface2}`]) {
                c2 += icc[`${interface1},${interface2}`] * (alpha[CType] + alpha[CType2])/2;
            }
            else if (icc[`${interface2},${interface1}`]) {
                c2 += component._bindings[interface1].length * icc[`${interface2},${interface1}`] * (alpha[CType] + alpha[CType2])/2;
            }
        }
    }
    return c2;
}

// TODO improve detection of interface binding fields (should be sufficient for now)
function isInterface(i) {
    return i instanceof Array && i.length > 0 && i[0] !== null && i[0].split(",").length == 2;
}
function getComponentIn(binding, config) {
    let b = binding.split(',');
    if (b.length != 2) {
        return null;
    }
    let cID = b[0].trim();
    return getComponent(config, cID);
}

function getComponent(config, cID) {
    for (let CType in config) {
        if (config[CType][cID]) {
            return config[CType][cID];
        }
    }
    return null;
}




/***********************************
 *       SCORE COMPUTATION
 ***********************************/

function score(config) {
    let score = {};
    collectParams(config).forEach(function(p) {
        score[p] = scorePar(config, p);
    });
    return score;
}

function collectParams(instances) {
    let params = [];
    for (let CType in instances) {
        for (let c in instances[CType]) {
            let component = instances[CType][c];
            if (component._parameters) {
                for (let param in component._parameters) {
                    if (typeof component._parameters[param] === "number" && params.indexOf(param) < 0) {
                        params.push(param);
                    }
                } 
            }
        }
    }
    return params;
}


function scorePar(config, param) {
    let l = getValuesForParameter(config, param);
    let moy = l.length > 0 ? (l[0] + l[l.length - 1]) / 2 : 0;

    let scorePar = 0;
    for (let i=0; i < l.length; i++) {
        scorePar += Math.abs(l[i] - moy);
    }
    let minPar = Math.min(...l);
    let maxPar = Math.max(...l);
    if (l.length == 1) {
        return 0;
    }
    return scorePar * 100 / (l.length * (maxPar - minPar));
}

function getValuesForParameter(config, param) {
    let vals = [];
    for (let CType in config) {
        for (let c in config[CType]) {
            let component = config[CType][c];
            if (component._parameters && component._parameters[param] !== undefined) {
                vals.push(component._parameters[param]);
            }
        }
    }
    vals.sort();
    return vals;
}

function normalizeLists(list1, list2) {
    let l1 = [...list1], l2 = [...list2];
    
    if (l1.length == l2.length) {
        return [l1, l2];
    }

    if (l1.length < l2.length) {
        [ l1, l2 ] = [ l2, l1 ];
    }

    l1 = reduceLongestList(l1, l1.length - l2.length);

    return [l1, l2];
}

function reduceLongestList(l, n) {
    let indexes = Object.keys(l).map(e => Number(e));
    let indexesToRemove = indexes.filter((_, i, t) => i <= t.length - 2).sort(function(i1, i2) {
        return (l[i1+1]-l[i1]) - (l[i2+1]-l[i2])
    });
    let r = [...l];
    while (n > 0 && indexesToRemove.length > 0) {
        let i = indexesToRemove.shift();
        if (r[i] != null) {
            r[i] = (r[i] + r[i+1]) / 2;
            r[i+1] = null;
            n--;
        }
    }
    r = r.filter(e => e != null);
    return r; 
}


/*****
 *      SAMPLING USING K-MEANS ALGORITHM
 */
function KMeans(sample, K, distanceType) {
    sample = sample.map(e => vectorize(e, distanceType));
    let centroids = createRandomCentroids(sample, K);
    let affiliation = getClosestCentroid(sample, centroids);
    let newAffiliation = [...affiliation];
    do {
        affiliation = newAffiliation;
        updateCentroids(centroids, sample, affiliation);
        newAffiliation = getClosestCentroid(sample, centroids);
    } while (String(affiliation) != String(newAffiliation));
    return affiliation;
}


const C_ONLY = "c-only", P_ONLY = "p-only", CP_SEPARATED = "cp-separated", CP_GROUPED = "cp-grouped";

function vectorize(data, type) {
    // do something depending on distanceType
    let scores;
    switch (type) {
        case C_ONLY:
            return { __complexity: data.complexity };
            
        case P_ONLY:
            scores = { };
            for (let i in data.score) {
                scores[i] = data.score[i];
            }
            return scores;
            
        case CP_GROUPED:
            scores = 0;
            let n = 0;
            for (let i in data.score) {
                scores += data.score[i];
                n++;
            }
            scores = (n > 0) ? scores / n : 0;
            return { __complexity: data.complexity, __score: scores };

        case CP_SEPARATED:
        default: 
            scores = { __complexity: data.complexity };
            for (let i in data.score) {
                scores[i] = data.score[i];
            }
            return scores;
    }
}


/**
 * Create a set of centroids based on the 
 * @param {Array} sample 
 * @param {number} K 
 */
function createRandomCentroids(sample, K) {
    let ret = [...sample];
    while (ret.length > K) {
        ret.splice(0, 1);
    }    
    return ret;
}


/**
 * Computes the affiliation of each sample to its closest centroid
 */
function getClosestCentroid(sample, centroids) {
    let affiliation = [];
    for (let i in sample) {
        let min = distance(centroids[0], sample[i]);
        let idxMin = 0;
        for (let j=1; j < centroids.length; j++) {
            let d = distance(centroids[j], sample[i]);
            if (d < min) { 
                min = d; 
                idxMin = j;
            }    
        }
        affiliation[i] = idxMin;
    }
    return affiliation;
}

function updateCentroids(centroids, sample, affiliation) {
    for (let i in centroids) {
        let centroid = centroids[i];
        let nb = 0;

        let newCentroid = {};
        for (let key in centroid) {
            newCentroid[key] = 0;
        }
        // for each element affiliated to this centroid
        for (let j in affiliation) {
            if (affiliation[j] == i) {
                for (let key in sample[j]) {
                    newCentroid[key] += Number(sample[j][key]);
                }
                nb++;
            }
        }
        for (let key in centroid) {
            if (nb > 0) {
                centroid[key] = newCentroid[key] / nb;
            }
        }
    }
}

function distance(data1, data2) {
    let sum = 0;
    for (let i in data1) {
        if (data2[i] !== undefined) {
            sum += (data1[i] - data2[i]) * (data1[i]- data2[i]);
        }
    }
    return sum;
}


// if the module has no dependencies, the above pattern can be simplified to
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.returnExports2 = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

    // Just return a value to define the module export.
    // This example returns an object, but the module
    // can return a function as the exported value.
    return { "complexity": complexity, "score": score, "scorePar": scorePar, "KMeans": KMeans};
}));