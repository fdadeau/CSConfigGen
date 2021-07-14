import { generate, generateParameters } from "./combinatorial.js";


document.addEventListener("DOMContentLoaded", function() {
    
    const MODEL = document.getElementById("model");
    
    // read the JSON file
    document.getElementById("fileReader").addEventListener("change", function(e) {
        var file = e.target.files[0];
        if (!file) {
            return;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
            var contents = e.target.result.replaceAll("\t", "  ");
            if (! JSON.parse(contents)) {
                alert("File does not contain a valid JSON data structure");   
                return;
            }
            MODEL.value = contents;
        };
        reader.readAsText(file);
    });
        
    
    // initialize with sample data
    (function() {
        fetch("./data/sample.json").then(function(data) {
            return data.text()
        }).then(function(text) {
            MODEL.value = text.replaceAll("\t", "  ");
        });
    })();
    
    // desactivate <tab> key
    MODEL.addEventListener("keydown", function(e) {
        if (e.keyCode == 9) {
            e.preventDefault();
            this.setRangeText('  ', this.selectionStart, this.selectionEnd, 'end');
        }
    });


    /**** DATA MODEL ****/
    
    // Component model in JSON
    let description = {};
    // Parameters (#instances for each component type)
    let params = { max: 10, cardinalities: {} };
    // Functions to instanciate data
    let funcForDataTypes = {};
    // Invariant 
    let invariant;
    
    document.getElementById("btnNext0").addEventListener("click", function(e) {
        
        let err = validateDescription(MODEL.value);
        
        const an = document.getElementById("analysis");
        if (err.length > 0) {
            an.innerHTML = "<ul><li>" + err.join("</li><li>") + "</li></ul>";
            an.className = "error";
        }
        else {
            an.innerHTML = "The component model description is valid.";
            an.className = "ok";
            description = JSON.parse(MODEL.value);
            generateParameterization(description);
            document.querySelector("section:nth-of-type(1)").style.display = "none";
            document.querySelector("section:nth-of-type(2)").style.display = "block";
        }
        an.style.display = "block";
    });
    
    document.getElementById("btnPrevious0").addEventListener("click", function(e) {
         document.querySelector("section:nth-of-type(1)").style.display = "block";
         document.querySelector("section:nth-of-type(2)").style.display = "none";
    });
    
    
    document.getElementById("btnNext1").addEventListener("click", function(e) {
        generateFunctions(description);
        document.querySelector("section:nth-of-type(2)").style.display = "none";
        document.querySelector("section:nth-of-type(3)").style.display = "block";
    });
    
    document.getElementById("btnPrevious1").addEventListener("click", function(e) {
         document.querySelector("section:nth-of-type(2)").style.display = "block";
         document.querySelector("section:nth-of-type(3)").style.display = "none";
    });
    
    document.getElementById("btnNext2").addEventListener("click", function(e) {
        if (verifyFunctions()) {
            generateInstances();        
            document.querySelector("section:nth-of-type(3)").style.display = "none";
            document.querySelector("section:nth-of-type(4)").style.display = "block";
        }
    });

    document.getElementById("btnPrevious2").addEventListener("click", function(e) {
         document.querySelector("section:nth-of-type(3)").style.display = "block";
         document.querySelector("section:nth-of-type(4)").style.display = "none";
    });
    
    
    document.getElementById("btnSolutionPrevious").addEventListener("click", function(e) {
        if (current > 0) {
            current--;
            afficherSolution(current);
        }
    });
    document.getElementById("btnSolutionNext").addEventListener("click", function(e) {
        if (current < solutions.length - 1) {
            current++;
            afficherSolution(current);
        }
    });
    
    
    function verifyFunctions() {
        // parsing invariant
        try {
            let codeInv = document.getElementById("funcInvariant").value;
            invariant = new Function("self", codeInv);    
        }
        catch ($exc) {
            alert("Error in invariant function code: " + $exc);
            return false;
        }
        
        return true;    
    }
    
    let solutions = [];
    let current = -1;
    
    
    function generateInstances() {

        let nb = 0;
        
        try {
            
            solutions = [];
            
            // building iterator
            let inst = generate(description, params, funcForDataTypes);
            // successive values
            let i;
            
            // functions to be used
            let f = {};
            for (let t in funcForDataTypes) {
                f[t] = new Function(funcForDataTypes[t]);   
            }
            
            let total = document.getElementById("totalSolutions");
            document.getElementById("nbSolution").innerHTML = 0;
            document.getElementById("bcSolution").innerHTML = "";
            
            // main loop for generating function
            while ((i = inst.next()).value !== undefined) {
                generateParameters(description, f, i.value);
                let bool = true;
                for (let ctype in i.value) {
                    if (bool) {
                        for (let self in i.value[ctype]) {
                            bool = bool && invariant(i.value[ctype][self]);
                        }
                    }
                }
                if (bool) {
                    solutions.push(i.value);
                    if (nb == 0) {
                        afficherSolution(0);   
                        current = 0;
                    }
                    nb++;
                    total.innerHTML = nb;
                }
            }
            
        }
        catch (exc) {
            console.error("Erreur : " + exc);
            throw exc;
        }
    }
    
    
    
    function afficherSolution(nb) {
        document.getElementById("nbSolution").innerHTML = (nb+1);
        let instance = solutions[nb];
        let html = "<ul>";
        for (let ctype in instance) {
            html += "<li>Components of type <i>" + ctype + "</i><ul>";
            for (let id in instance[ctype]) {
                let inst = instance[ctype][id];
                console.log(inst);
                html += "<li id='" + id + "'>" + id + ":<br>";
                if (inst.parent) {
                    html += " - parent: " + linkToInstance(inst.parent) + "<br>";
                }
                if (inst.children) {
                    html += " - children: " + inst.children.map(e => linkToInstance(e)).join(", ") + "<br>";   
                }
                for (let att in inst) {
                    if (att != "parent" && att != "children" & att != "_ctype") {
                        let val = inst[att];
                        if (val instanceof Array) {
                            html += " - " + att + ": [" + 
                                val.map(e => (e != null && e.indexOf(",") > 0) ? linkToInstance(e.split(",")[0]) + "." + e.split(",")[1] : (e == null ? "" : e)).join(", ") + "]";
                        }
                        else {
                            html += " - " + att + ": " + val;
                        }
                        html += "<br>";
                    }
                }
            }
            html += "</ul></li>";
        }
        html += "</ul>";
        document.getElementById("bcSolution").innerHTML = html;
    }
    
    function linkToInstance(name) {
        return "<a href='#" + name + "'>" + name + "</a>";   
    }

    
    
    document.getElementById("nbMaxInstances").addEventListener("change", function() {
        params.max = 1 * this.value;
    });
    
    function generateParameterization(desc) {
        const table = document.querySelector("#tblNumberInstances tbody");
        table.innerHTML = "";
        // identify CTypes
        for (let ctype of desc.Elements.CTypes) {
            if (!params.cardinalities[ctype]) {
                params.cardinalities[ctype] = { min: 1, max: 2 };   
            }
            let tr = document.createElement("tr");
            let td0 = document.createElement("td");
            td0.innerHTML = ctype;
            let td1 = document.createElement("td");
            let td2 = document.createElement("td");
            //
            let inputMin = document.createElement("input");
            inputMin.id = "min-" + ctype;
            let inputMax = document.createElement("input");
            inputMax.id = "max-" + ctype;
            inputMin.type = inputMax.type = "number";
            inputMin.min = 0;
            inputMin.value = inputMax.min = params.cardinalities[ctype].min;
            inputMin.max = inputMax.value = params.cardinalities[ctype].max;
            inputMax.addEventListener("change", function(e) {
                document.getElementById("min-" + this.id.substr(4)).setAttribute("max", this.value); 
                params.cardinalities[this.id.substr(4)].max = 1 * this.value;
            });
            inputMin.addEventListener("change", function(e) {
                document.getElementById("max-" + this.id.substr(4)).setAttribute("min", this.value); 
                params.cardinalities[this.id.substr(4)].min = 1 * this.value;
            });
            td1.appendChild(inputMin);
            td2.appendChild(inputMax);
            //
            tr.appendChild(td0);      
            tr.appendChild(td1);      
            tr.appendChild(td2);
            table.appendChild(tr);
        }        
    }
    
    
    let invariantCode = "return true;";
    
    document.getElementById("funcInvariant").addEventListener("change", function() {
        invariantCode = this.value; 
    });
    
    function generateFunctions(desc) {
        const table = document.querySelector("#functionData tbody");
        table.innerHTML = "";
        for (let ptype of desc.Elements.PTypes) {
            let tr = document.createElement("tr");
            let td0 = document.createElement("td");
            td0.innerHTML = ptype;
            let td1 = document.createElement("td");
            let ta = document.createElement("textarea");
            ta.setAttribute("data-ptype", ptype);
            ta.value = funcForDataTypes[ptype] ? funcForDataTypes[ptype] : "return Math.random() * 100 | 0;";   
            ta.addEventListener("change", function() {
                funcForDataTypes[this.dataset["ptype"]] = this.value; 
                console.log(this.value);
            });
            td1.appendChild(ta);
            tr.appendChild(td0);
            tr.appendChild(td1);
            table.appendChild(tr);
        }
    }
    
    
    
    
    function validateDescription(d) {
        
        let errors = [];
        let json = null;
        
        try {
            json = JSON.parse(d);
        }
        catch ($err) {
            // parsing KO --> return
            if (!json) {
                errors.push("The content of the description is not in the JSON format. Please ensure that attributes names are delimited by double-quotes \"");   
            }
            return errors;
        }
        
        if (!json.Elements) {
            errors.push("<code>Elements</code> attribute is missing.");   
        }
        else {
            // verification of component types 
            errors = errors.concat(verifyArray(json.Elements, "CTypes", "component types", "string", true, true));
            // verification of required interfaces 
            errors = errors.concat(verifyArray(json.Elements, "IRequired", "required interfaces", "string", false, true));
            // verification of provided interfaces 
            errors = errors.concat(verifyArray(json.Elements, "IProvided", "provided interfaces", "string", false, true));
            // verification of parameters 
            errors = errors.concat(verifyArray(json.Elements, "Parameters", "parameters", "string", false, true));
            // verification of parameter types
            errors = errors.concat(verifyArray(json.Elements, "PTypes", "parameter types", "string", false, true));        
        }
        
        return errors;
    }
    
    
    /** 
     *  Checks the existence of the array and its 
     */
    function verifyArray(array, attribute, label, type, nonempty, alldifferent) {
        if (! array[attribute]) {
            return ["<code>" + attribute + "</code> attribute containing an array of " + type + "s describing " + label + " is missing."];
        }
        if (!(array[attribute] instanceof Array)) {
            return ["<code>" + attribute + "</code> attribute should be a non-empty array of " + type + "s describing " + label + "."]; 
        }
        if (nonempty && array[attribute].length == 0) {
            return ["<code>" + attribute + "</code> array should not be empty."];
        }
        if (alldifferent && !array[attribute].every((e,i,t) => typeof(e) == type && 
                                                    e.length > 0 && 
                                                    t.every((e1, i1) => i1 >= i || e1 != e))) {
                return ["<code>" + label + "</code> attribute should be an array of non-empty and all different " + type + "s describing component types."];
        }
        return [];
    }
    
    
});

