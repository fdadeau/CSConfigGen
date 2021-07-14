
const DEBUG = false;


//------------------- GENERATION OF CONFIGURATIONS ------------------------//

/*** 
 *  Combinatorial generation of configurations. 
 *  @param  Object  description     the JSON description of the 
 */
export function* generate(description, params) {

    checkParameter(description, params);
    
    yield* genRepartition(description, params);
    
}


//------------------- GENERATION OF COMPONENT INSTANCES ------------------------//

/**
 *  Generate a repartition of the instances.
 */
function* genRepartition(description, params) {
    
    // repartition -> determine how many components of each type have to be generated
    let repartition = {};
    
    let sum = function() {
        let sum = 0;
        for (let k in repartition) {
            sum += repartition[k];
        }
        return sum;
    }
    
    // array of keys
    let keys = [];
    
    // total of instances
    let total = 0;
    
    // initialize array with initial cardinalities
    for (let index in params.cardinalities) {
        let nb = params.cardinalities[index].min;
        repartition[index] = nb;
        keys.push(index);
        total += nb;
    }

    // if too many minimal instances, return
    if (total > params.max) {
        return;
    }
    
    yield* generateParents(description, createInstancesFromRepartition(repartition));
    
    // currentIdx at last position
    let currentIdx = keys.length - 1;
    
    do {
        // incrément du dernier élément
        currentIdx = keys.length - 1;
        let ctype = keys[currentIdx];
        repartition[ctype]++;
        
        // on remonte dans les éléments précédents
        while (currentIdx >= 0 && (repartition[ctype] > params.cardinalities[ctype].max || sum() > params.max)) {
            // on remet l'élément courant à sa valeur de départ
            repartition[ctype] = params.cardinalities[ctype].min;
            // on passe à l'élément précédent 
            currentIdx--;  
            if (currentIdx >= 0) {
                // s'il existe on l'incrémente
                ctype = keys[currentIdx];
                repartition[ctype]++;
            }
        }
        //
        if (currentIdx >= 0) {
            yield* generateParents(description, createInstancesFromRepartition(repartition));
        }
    }
    while (currentIdx >= 0);
    
}


/** 
 *  Creates the instances objects w.r.t. the repartition given in parameter.
 *  @param  Object  repartition     of the form { CType => #instances }
 *  @return Object  a set of instances indexed by CType
 */
function createInstancesFromRepartition(repartition) {
    let instances = {}; 
    for (let k in repartition) {
        instances[k] = {};
        for (let i=0 ; i < repartition[k]; i++) {
            instances[k][`${k}_${i}`] = {_ctype: k };
        }   
    }
    return instances;
}



//------------------- GENERATION OF PARAMETERS ------------------------//


/** 
 *  Generates the parameters based on the Definer set of Relations. 
 */
export function generateParameters(description, funcForData, instances) {
    for (let name in description.Relations.Definer) {
        let ctype = description.Relations.Definer[name];
        DEBUG && console.log("Generating parameter " + name + " for instances of " + ctype);
        // for each instance of the type
        if (instances[ctype]) {
            for (let instID in instances[ctype]) {
                // determine type
                let type = description.Relations.ParameterType[name];
                if (!type) {
                    throw { msg: "Parameter type undefined for " + name };
                }
                // generate data value according to type
                if (funcForData[type]) {
                    instances[ctype][instID][name] = funcForData[type]();
                }
                else {
                    instances[ctype][instID][name] = 0;
                }
            }
        }
    }
}



//------------------- GENERATION OF PARENTS/CHILDREN ------------------------//


/** 
 *  Generate the parents for each component based on the Parent function of Relations. 
 *  
 */
function* generateParents(description, _instances) {
    
    // copy of instances used as a response
    var instances = JSON.parse(JSON.stringify(_instances));
    
    // set of possible parent instances according to their types { CType -> [ Inst1, Inst2, ... ] }
    var possibleParents = {};
    for (let ctype in instances) {
        possibleParents[ctype] = [null];
        if (!description.Relations.Parent[ctype]) {
            throw { msg: "No defined parent for components of type " + ctype };   
        }
        for (let par of description.Relations.Parent[ctype]) {
            if (par) {
                possibleParents[ctype].push(...Object.keys(instances[par]));
            }
        }
    }
    
    // indexes for combinatorial generation     { inst -> { current: currentIndex, max: maxIndex }, ... }
    var parentsIdx = {};
    for (let ctype in instances) {
        for (let inst in instances[ctype]) {
            parentsIdx[inst] = { current: 0, min: 0, max: possibleParents[ctype].length - 1};
        }
    }
   
    var hashes = [];
    do {
        // assign parents 
        for (let ctype in instances) {
            for (let inst in instances[ctype]) {
                instances[ctype][inst].parent = possibleParents[ctype][parentsIdx[inst].current];
            }
        }
        // proceed to next step
        if (isParentingValid(instances, hashes)) {
            // yield { instances: instances, bindings: {} };
            yield* generateDelegations(description, instances);
        }
    } while (next(parentsIdx));
    
}


/**
 *  Checks if the current parent assignment is correct. 
 *  @param  Object  instances   the current parent assignemnt
 *  @param  Array   hashes      the set of hsahes already generated
 *  @return boolean             true if the proposed parenting is coherent and not generated before (modulo permutation)
 */
function isParentingValid(instances, hashes) {
    // compute hash for current instances
    let children = {};
    let root = [];
    // counts the number of children for composite components
    let count = {};
    for (let ctype in instances) {
        for (let inst in instances[ctype]) {
            let k = instances[ctype][inst];
            if (k.parent != null) {
                if (!children[k.parent]) {
                    children[k.parent] = {};   
                }
                if (!children[k.parent][ctype]) {
                    children[k.parent][ctype] = [];
                }
                if (! count[k.parent]) {
                    count[k.parent] = 0;
                }
                children[k.parent][ctype].push(inst);
                count[k.parent]++;
            }
            else {
                root.push(inst);   
            }
        }
    }
    
    // check that composite parents have at least two children (or none)
    for (let n in count) {
        if (count[n] <= 1) { 
            return false;
        }
    }
    
    DEBUG && console.dir(root);
    DEBUG && console.dir(children);
    
    /**
     *  Computes the hash of a tree based on the type of the tree entries
     *  @param  Array   nodes               list of current-level node names
     *  @param  Object  childrenNodes       all the children for all nodes (names only)
     */
    function compute_hash(nodes, childrenNodes) {
        let hash = [];
        for (let node of nodes) {
            if (childrenNodes[node]) {
                let tab = [];
                for (let ctype in childrenNodes[node]) {
                    tab = tab.concat(childrenNodes[node][ctype]);
                }
                hash.push(node.substring(0, node.lastIndexOf("_")) + compute_hash(tab, childrenNodes));
            }
            else {
                hash.push(node.substring(0, node.lastIndexOf("_")));   
            }
        }
        hash.sort();
        return "(" + hash.join(",") + ")";
    }
    
    // compute hash for current instances
    let hash = compute_hash(root, children);
    
    // check if hash already met
    DEBUG && console.log("check if hash " + hash + "\nin " + hashes.join(",\n"));
    if (true 
        && hashes.indexOf(hash) < 0
       ) {
        // store the hash and acknowledge unknown new repartition
        hashes.push(hash);
        return true;
    }
    // else 
    return false;   
}


//------------------- GENERATION OF DELEGATIONS ------------------------//

/**
 *  For each parent instance, bind mandatory delegated interfaces. 
 *  @param  Object  description     the JSON description of the component model (Elements, Relations)  
 *  @param  Object  instances       the current set of instances
 */
function* generateDelegations(description, _instances) {
    // copy existing instances
    let instances = JSON.parse(JSON.stringify(_instances));
    
    // add to components their children
    for (let ctype in instances) {
        for (let inst in instances[ctype]) {
            let pName = instances[ctype][inst].parent;
            if (pName != null) {
                let parentCType = pName.substring(0, pName.lastIndexOf("_"));
                let parent = instances[parentCType][pName];
                if (parent.children === undefined) {
                    parent.children = [];
                }
                parent.children.push(inst);
            }
        }
    }
    
    // delegated interfaces    
    let data = {};
    // repartition for provided interfaces
    let repartitionP = {};
    // repartition for required interfaces
    let repartitionR = {};
        
    // identify components that should have a delegated interface 
    for (let iDelegatedProvided of description.Relations.DelegateProv) {
        // identifying elements that can be connected
        let iParent = iDelegatedProvided[1];    
        let iParentCType = description.Relations.Provider[iParent];
        let iParentComponents = Object.keys(instances[iParentCType]);
        let iChild = iDelegatedProvided[0];
        let iChildCType = description.Relations.Provider[iChild];
        let iChildComponents = Object.keys(instances[iChildCType]);
        // assuming that delegated interfaces should always be delegated
        for (let pInst of iParentComponents) {
            let key = `${pInst},${iParent}`;
            // compute possible children to delegate the provided interface 
            let possibleChildren = iChildComponents.filter(e => instances[iChildCType][e].parent == pInst);
            if (possibleChildren.length == 0) {
                DEBUG && console.log(" -> failed due to empty children set for component " + pInst);
                return;
            }
            data[key] = possibleChildren.map(cInst => `${cInst},${iChild}`);
            repartitionP[key] = { current: 0, min: 0, max: data[key].length - 1 };
        }
    }
    
    
     // identify components that should have a delegated interface 
    for (let iDelegatedRequired of description.Relations.DelegateReq) {
        // identifying elements that can be connected
        let iParent = iDelegatedRequired[1];    
        let iParentCType = description.Relations.Requirer[iParent];
        let iParentComponents = Object.keys(instances[iParentCType]);
        let iChild = iDelegatedRequired[0];
        let iChildCType = description.Relations.Requirer[iChild];
        let iChildComponents = Object.keys(instances[iChildCType]);
        // assuming that delegated interfaces should always be delegated
        for (let pInst of iParentComponents) {
            let key = `${pInst},${iParent}`;
            // compute possible children to delegate the required interface 
            let possibleChildren = iChildComponents.filter(e => instances[iChildCType][e].parent == pInst);
            if (possibleChildren.length == 0) {
                DEBUG && console.log(" -> failed due to empty children set for component " + pInst);
                return;
            }
            data[key] = possibleChildren.map(cInst => `${cInst},${iChild}`);
            repartitionR[key] = { current: 0, min: 0, max: data[key].length - 1 };
        }
    }
    
    
    let hashesR = [];
    
    // Two loops to combine required & provided interfaces delegations
    do {
        // external loop: required interfaces
        if (isDelegationValid(repartitionR, data, description.Relations.Contingency)) {
               
            // define delegations of required interfaces
            let delegR = {};
            for (let key0 in repartitionR) {
                delegR[key0] = data[key0][repartitionR[key0].current];   
            }
            
            let hashR = computeHashForDelegation(delegR, instances);
            // console.log(hashR);
            if (true 
                //&& hashesR.indexOf(hashR) < 0
               ) {
                // add to hashes    
                hashesR.push(hashR);
            
                let hashesP = [];
                
                // next 
                do {

                    if (isDelegationValid(repartitionP, data, description.Relations.Contingency)) {

                        // define delegations of provided interfaces
                        let delegP = {};
                        for (let key1 in repartitionP) {
                            delegP[key1] = data[key1][repartitionP[key1].current];
                        }                    
                        
                        let hashP = computeHashForDelegation(delegP, instances);
                        if (true 
                           && hashesP.indexOf(hashP) < 0
                           ) {
                            // add to hashes
                            hashesP.push(hashP);   
                            // proceed to last step
                            yield* generateBindings(description, instances, { required: delegR, provided: delegP });   
                        }
                    }

                } while (next(repartitionP));
            }
        }
        
    } while (next(repartitionR));
    
}


/**
 *  Compute the hash for a given delegation.
 */
function computeHashForDelegation(deleg, instances) {
    
    let t = {};
    for (let left in deleg) {
        let right = deleg[left];
        let right0 = right.split(",")[0];
        let right1 = right.split(",")[1];
        let left0 = left.split(",")[0];
        let left1 = left.split(",")[1];
        if (! t[right0]) {
            t[right0] = [];
        }
        t[right0].push({ parent: left0, parentD: left1, childD: right1 });
    }
    
    let ret = [];
    for (let child in t) {
        ret.push("{" + toTerm(child, instances) + "," + 
                 "[" + t[child].map(e => e.childD + "--" + e.parentD + "--" + toTerm(e.parent, instances)).sort().join(",") + "]}");
    }
    
    return ret.sort().join("");
}


/**
 *  Checks if current delegation is valid (especially w.r.t. contingencies).
 *  @param  Object  repartition     Current repartition, of the form { iParent => { current: X, min: Y, max: Z } ... }
 *  @param  Object  data            Possible data, of the form { iParent => [ iChild0, iChild1, ...], ... }
 *  @param  Object  contingencies   Contingencies of the interfaces { interface => single/multiple-optional/mandatory ... }
 *  @return boolean                 true if current repartition is valid
 */
function isDelegationValid(repartition, data, contingencies) {
    
    // list to record the used interfaces
    let assignedInterfaces = [];
    
    for (let iParent in repartition) {
        let current = repartition[iParent].current;
        let iChild = data[iParent][current];        // of the form InstanceName,Interface
        let iChildName = iChild.split(",")[1];
        let iChildContingency = contingencies[iChildName];
        if (assignedInterfaces.indexOf(iChild) >= 0) {
            // case of multiple assignment to a delegated interface
            return false;   
        }
        assignedInterfaces.push(iChild);
    }
    
    return true;
}
    

/**
 *  Add the (left <--> right) binding to the set of bindings (bi-directional associative array).
 *  @param  Object  bindings    { interface => [ boundInterface0, boundInterface1, ... ], ... }
 *  @param  String  left        left-hand side, of the form "InstanceName,Interface"
 *  @param  String  right       right-hand side, of the form "InstanceName,Interface"
 */
function addBinding(bindings, left, right) {
    if (right instanceof Array && right.length == 0) {
        right = null;
    }
    // left -> [ right ... ]
    if (!bindings[left]) {
        bindings[left] = (right instanceof Array) ? right : [ right ];
    }
    else {
        bindings[left].push(right);
    }
    if (right == null) {
        return;     // case of null assignment on the right hand side   
    }
    // right -> [ left ... ]
    if (right instanceof Array) {
        for (let rightE of right) {
            if (!bindings[rightE]) {
                bindings[rightE] = [ left ];
            }
            else {
                bindings[rightE].push(left);
            }
        }
    }
    else {
        if (!bindings[right]) {
            bindings[right] = [ left ];
        }
        else {
            bindings[right].push(left);   
        }
    }
}




//------------------- GENERATION OF BINDINGS ------------------------//

function* generateBindings(description, instances, delegations) {
    
    let data = {};
    let repartition = {};
    
    let mandatoryPInterfaces = [];
    
    // parcourir les interfaces *restantes* (description.Relations.bindings)
    for (let iRequiredName in description.Relations.Binding) {        
        // identifier les interfaces requises et fournies
        let iRequiredCType = description.Relations.Requirer[iRequiredName];
        let iRequiredComponents = Object.keys(instances[iRequiredCType]);
        
       // pour chaque interface, constituer l'ensemble des données candidates   ( + ajouter fonction ensembles des parties )
        for (let iRequiredInstance of iRequiredComponents) {
            let bLeft = `${iRequiredInstance},${iRequiredName}`;
            // si l'interface required est déléguée --> on ne la considère pas
            if (delegations.required[bLeft]) {
                continue;   
            }
         
            // calcul des valeurs possibles pour cette 
            let possibleValues = [];
            
            for (let iProvidedName of description.Relations.Binding[iRequiredName]) {
                
                let iProvidedCType = description.Relations.Provider[iProvidedName];
                
                let possibleValues0 = Object.keys(instances[iProvidedCType]);
                // list of mandatory requiring
                if (description.Relations.Contingency[iProvidedName].endsWith("mandatory")) {
                    for (let iProv of possibleValues0) {
                        let delegated = false;
                        for (let j in delegations.provided) {
                            if (delegations.provided[j] == `${iProv},${iProvidedName}`) {
                                delegated = true;
                                break;
                            }
                        }
                        if (!delegated && mandatoryPInterfaces.indexOf(`${iProv},${iProvidedName}`) < 0) {
                            mandatoryPInterfaces.push(`${iProv},${iProvidedName}`);   
                        }
                    }
                }                    
                
                // remove instances that are already bound and whose contingency is single
                possibleValues0 = possibleValues0
                                        // provided interface should not be already delegated (RHS of deleagations.provided)
                                        .filter(e => {
                                            for (let i in delegations.provided) {
                                                if (`${e},${iProvidedName}` == delegations.provided[i]) {
                                                    return false;   
                                                }
                                            }
                                            return true;
                                        })
                                        // should not be carried by the same instance as the requiring component
                                        .filter(e => e != iRequiredInstance)
                                        // should have the same parent as the requiring component
                                        .filter(e => instances[iProvidedCType][e].parent == 
                                                     instances[iRequiredCType][iRequiredInstance].parent)
                                        .map(e => `${e},${iProvidedName}`);
                
                possibleValues = possibleValues.concat(possibleValues0);
            }
                
            // cas des multiples
            if (description.Relations.Contingency[iRequiredName].startsWith("multiple")) {
                possibleValues = computePowerset(possibleValues);   
                if (description.Relations.Contingency[iRequiredName].endsWith("mandatory")) {
                    // remove empty set
                    possibleValues.pop();   
                }
            }
            // cas des single-optional -> add null
            else if (description.Relations.Contingency[iRequiredName].endsWith("optional")) {
                possibleValues.unshift(null);   
            }
            // no potential value for this interface --> return
            if (possibleValues.length == 0) {
                return;   
            }
        
            data[bLeft] = possibleValues;
            repartition[bLeft] = { current: 0, min: 0, max: possibleValues.length - 1 };
        }
    }
    
    /* ----- 
    console.log("instances");
    console.dir(instances);
    console.log("delegs");
    console.dir(delegations);
    console.log("possible values :");
    console.dir(data);
    */
    
    let hashes = [];
    
    do {
     
        let bindings = {}
        
        if (isBindingValid(repartition, data, description.Relations.Contingency)) {
            for (let key in repartition) {
                addBinding(bindings, key, data[key][repartition[key].current]);
            }
            
            let hash = computeHashForBindings(bindings, instances, description);
              //  console.log(hash);
            
            if (hashes.indexOf(hash) < 0 && 
                hasNoLoop(bindings, description.Elements.IRequired) && 
                mandatoryPInterfaces.every(e => bindings[e] && bindings[e].length > 0 && bindings[e][0] != null)) {
                hashes.push(hash);
                yield applyBinding(instances, bindings);
            }
        }
    } while (next(repartition));
    
}

    
/**
 *  Compute hash for binding
 */
function computeHashForBindings(bindings, instances, description) {

    let t = {};
    for (let left in bindings) {    // left: Instance,Interface
        let left0 = left.split(",")[0];
        let left1 = left.split(",")[1];
        // only required interfaces are considered
        if (description.Elements.IRequired.indexOf(left1) >= 0) {
            let rights = bindings[left];
            if (! t[left0]) {
                t[left0] = [];
            }
            rights = rights.map(e => (e == null) ? "null" : e.split(",")[1] + "::" + toTerm(e.split(",")[0], instances)).sort().join(",");
            t[left0].push(left1 + "::[" + rights + "]");
        }
    }
    
    let ret = [];
    for (let child in t) {
        ret.push("{" + toTerm(child, instances) + "," +
                 "[" + t[child].sort().join(",") + "]}");
    }
    
    return ret.sort().join("");
}



/**
 *  Calcul de l'ensemble des parties d'un ensemble.
 */
function computePowerset(input) {
    if(input.length === 0) return [input];
    
    let first = input[0];
    let rest = computePowerset(input.slice(1));
    
    let tmp = rest.map(el => [first].concat(el));
    
    return tmp.concat(rest);
}



function isBindingValid(repartition, data, contingencies) {
    
    // list to record the used interfaces
    let assignedInterfaces = [];
    
    for (let iRequired in repartition) {
        let current = repartition[iRequired].current;
        let iProvided = data[iRequired][current];        // of the form InstanceName,Interface or Array of it
        if (iProvided instanceof Array) {
            for (let iProvidedElt of iProvided) {
                let iProvidedName = iProvidedElt.split(",")[1];
                let iProvidedContingency = contingencies[iProvidedName];
                if (assignedInterfaces.indexOf(iProvidedElt) >= 0 && iProvidedContingency.startsWith("single")) {
                    // case of multiple assignment to single contingency (only case of error, I think)
                    return false;   
                }
                assignedInterfaces.push(iProvidedElt);        
            }
        }
        else {
            // no checks for null values
            if (iProvided == null) {
                continue;   
            }
            let iProvidedName = iProvided.split(",")[1];
            let iProvidedContingency = contingencies[iProvidedName];
            if (assignedInterfaces.indexOf(iProvided) >= 0 && iProvidedContingency.startsWith("single")) {
                // case of multiple assignment to single contingency (only case of error, I think)
                return false;   
            }
            assignedInterfaces.push(iProvided);
        }
    }
    
    return true;
}


function hasNoLoop(binding, IRequired) {
    for (let interface0 in binding) {
        if (IRequired.indexOf(interface0.split(",")[1]) >= 0) {
            if (! hasNoLoop2(binding, interface0, interface0, IRequired)) {
                return false;
            }
        }
    }
    return true;
}
function hasNoLoop2(binding, needle, start, IRequired) {
    
    let nexts = binding[start];
    
    for (let next of nexts) {
        if (next == null) {
            continue;   
        }
        let inst = next.split(",")[0];
        for (let req of IRequired) {
            let newInt = `${inst},${req}`;
            if (newInt == needle) {
                return false;   
            }
            if (binding[newInt] && !hasNoLoop2(binding, needle, newInt, IRequired)) {
                return false;
            }
        }
    }
    return true;    
}
    


//------------------- UTILITY FUNCTIONS ------------------------//



function applyBinding(_instances, binding) {
    let instances = JSON.parse(JSON.stringify(_instances));
    for (let i in binding) {
        let iInstance = i.split(",")[0];
        let iInterface = i.split(",")[1];
        let iCType = iInstance.substring(0, iInstance.lastIndexOf("_"));
        instances[iCType][iInstance][iInterface] = binding[i];
    }
    return instances;
}



/**
 *  Computes a normalized tree-like representation of components types (with their children).
 *  @param      Object      component       the component 
 *  @param      Object      instances       the existing set of all instances
 */
function toTerm(cName, instances) {
    let cType = cName.substring(0, cName.lastIndexOf("_"));
    let inst = instances[cType][cName];
    
    let term = cType;
    if (inst.children && inst.children.length > 0) {
        term += "(" + inst.children.map(e => toTerm(e, instances)).sort().join(",") + ")"; 
    }
    return term;
}


/** 
 *  Checks the validity of parameters w.r.t. the description.
 *  @param  Object  description     Component model object description
 *  @param  Object  params          Parameters of the test generator
 *  @throws Exception when errors are found
 */
function checkParameter(description, params) {
    if (!params.cardinalities) {
        throw { msg: "No cardinalities specified" };   
    }
    
    if (Object.keys(params.cardinalities).length == 0) {
        throw { msg: "No component type cardinalities specified" };   
    }
    
    for (let cType in params.cardinalities) {
        if (description.Elements.CTypes.indexOf(cType) < 0) {
            throw { msg: `Component type "${cType}" does not exist in the component model` };
        }
    }
}


/**
 *  Helper function that enumerates through data of type { key => { current: I, min: m, max: M } }
 *  @return     boolean     true if there is a next solution (will be contained in the object)
 */
function next(data) {
    let keys = Object.keys(data);
    // set last index to last element
    let i = keys.length - 1;
    // no element on which iterate
    if (i < 0) { 
        return false;
    }
    do {
        // increment current index 
        let elem = keys[i];
        data[elem].current++;
        // if still in bounds -> return
        if (data[elem].current <= data[elem].max) {
            return true;   
        }
        // else reset current and consider previous index
        data[elem].current = data[elem].min;
        i--;
    }
    while (i >= 0);
    return false;
}

