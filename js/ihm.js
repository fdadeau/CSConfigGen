
import "./combinatorial.js";
import "./distance.js";

document.addEventListener("DOMContentLoaded", function() {
    
    const MODEL = document.getElementById("model");
    const INSTANCES = document.getElementById("instances2");

    
    // read the JSON file
    document.getElementById("fileReader").addEventListener("change", function(e) {
        var file = e.target.files[0];
        if (!file) {
            return;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
            var contents = e.target.result.replaceAll("\t", "  ");
            try {
                JSON.parse(contents);
                MODEL.value = contents;
                document.getElementById("analysis").innerHTML = "File parsed successfully.";
                document.getElementById("analysis").className = "ok";
            }
            catch (err) {
                document.getElementById("analysis").innerHTML = "File does not contain a valid JSON data structure.";
                document.getElementById("analysis").className = "error";
            }
            finally {
                document.getElementById("analysis").style.display = "block";
            }
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
        fetch("./data/VANET.2configs.json").then(function(data) {
            return data.text()
        }).then(function(text) {
            INSTANCES.value = text.replaceAll("\t", "  ");
        });
    })();
    
    // desactivate <tab> key
    MODEL.addEventListener("keydown", function(e) {
        if (e.keyCode == 9) {
            e.preventDefault();
            this.setRangeText('  ', this.selectionStart, this.selectionEnd, 'end');
        }
    });
    INSTANCES.addEventListener("keydown", function(e) {
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
    let funcForDataTypes = {
        "int": "return Math.random() * 100 | 0;",
        "float": "return (Math.random() * 1000 | 0) / 10;"
    };
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
            let inst = returnExports.generate(description, params, funcForDataTypes);
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
                returnExports.generateParameters(description, f, i.value);
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
                //console.log(inst);
                html += "<li id='" + id + "'>" + id + ":<br>";
                if (inst._parent) {
                    html += " - parent: " + linkToInstance(inst._parent) + "<br>";
                }
                if (inst.children) {
                    html += " - children: " + inst.children.map(e => linkToInstance(e)).join(", ") + "<br>";   
                }
                ["_bindings","_delegReq","_delegProv"].forEach(function(e) {
                    if (inst[e]) {
                        html += " - " + e + ": <br>";
                        for (let att in inst[e]) {
                            let val = inst[e][att];
                            if (val instanceof Array) {
                                html += " &nbsp;&nbsp;&nbsp;  -- " + att + ": [" + 
                                    val.map(e => (e != null && e.indexOf(",") > 0) ? linkToInstance(e.split(",")[0]) + "." + e.split(",")[1] : (e == null ? "" : e)).join(", ") + "]";
                            }
                            else {
                                html += " &nbsp;&nbsp;&nbsp;  -- " + att + ": " + val;
                            }
                            html += "<br>";
                        }
                    }
                });
                if (inst._parameters) {
                    html += " - Parameters: <br>";
                    for (let att in inst._parameters) {
                        let val = inst._parameters[att];
                        if (val instanceof Array) {
                            html += " &nbsp;&nbsp;&nbsp;  -- " + att + ": [" + String(val) + "]";
                        }
                        else {
                            html += " &nbsp;&nbsp;&nbsp;  -- " + att + ": " + val;
                        }
                        html += "<br>";
                    }
                }        
            }
            html += "</ul></li>";
        }
        html += "</ul>";
        document.getElementById("bcSolution").innerHTML = html;

        let linkToJSON = document.createElement("A");
        linkToJSON.id = "link2json";
        linkToJSON.target = "_blank";
        linkToJSON.innerHTML = "Export solutions as JSON";
        linkToJSON.href=window.URL.createObjectURL(new Blob([JSON.stringify(solutions)], { type: "application/json"}));
        document.getElementById("bcSolution").appendChild(linkToJSON);
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
            if (! funcForDataTypes[ptype]) {
                funcForDataTypes[ptype] = "return Math.random() * 100 | 0;";
            }
            ta.value = funcForDataTypes[ptype];
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
    


    /*** SAMPLING PART ***/

        document.getElementById("fileReader2").addEventListener("change", function(e) {
        var file = e.target.files[0];
        if (!file) {
            return;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
            var contents = e.target.result.replaceAll("\t", "  ");
            validateInput(contents);
        };
        reader.readAsText(file);
    });


    function validateInput(contents) {
        try {
            let configs = JSON.parse(contents);
            let errors = verifInstances(configs);
            if (errors == 0) {
                INSTANCES.value = contents;
                document.getElementById("analysis2").innerHTML = "File parsed successfully.";
                document.getElementById("analysis2").className = "ok";
                return true;
            }
            else {
                document.getElementById("analysis2").innerHTML = "Incorrent file content (code: " + errors + ")";
                document.getElementById("analysis2").className = "error";
            }    
        }
        catch (err) {
            console.log(err);
            document.getElementById("analysis2").innerHTML = "File does not contain a valid JSON file.";
            document.getElementById("analysis2").className = "error";
        }
        finally {
            document.getElementById("analysis2").style.display = "block";
        }
        return false;
    }

    function verifInstances(configs) {
        if (!configs.length || configs.length == 0) { 
            return -1;
        }
        for (let config of configs) {
            if (Object.keys(config).length == 0) {
                return -2;
            }
            for (let CType in config) {
                for (let id in config[CType]) {
                    if (config[CType][id]._parent === undefined) {
                        return -3;
                    }
                }
            }
        }
        return 0;
    }

    let myALPHA = {};
    let myICC = {};

    document.getElementById("btnNext0_2").addEventListener("click", function() {
        if (! validateInput(INSTANCES.value)) {
            return;
        }
        // find CTypes
        let configs = JSON.parse(INSTANCES.value)
        myALPHA = {};
        // find interfaces
        myICC = {};
        for (let config of configs) {
            for (let ctype in config) {
                myALPHA[ctype] = 2;
                for (let id in config[ctype]) {
                    let component = config[ctype][id];
                    if (component._bindings) {
                        for (let i1 in component._bindings) {
                            let b = component._bindings[i1];
                            if (b.length > 0 && b[0] != null && b[0].split(",").length == 2) {
                                let i2 = b[0].split(",")[1];
                                let intr = `${i1},${i2}`;
                                let intr2 = `${i2},${i1}`;
                                if (!myICC[intr] && !myICC[intr2]) {
                                    myICC[intr] = 0.2;
                                }
                            }
                        }  
                    }
                    ["_delegProv", "_delegReq"].forEach(function(e) {
                        if (component[e]) {
                            for (let i1 in component[e]) {
                                let b = component[e][i1][0];
                                if (b.split(",").length == 2) {
                                    let i2 = b.split(",")[1];
                                    let intr = `${i1},${i2}`;
                                    let intr2 = `${i2},${i1}`;
                                    if (!myICC[intr] && !myICC[intr2]) {
                                        myICC[intr] = 0.2;
                                    }
                                }
                            }  
                        }
                    });
                }
            }
        }

        // generate GUI for CTypes
        let form = document.querySelector("#step1_2 form");
        form.innerHTML = "";
        let p1 = document.createElement("p");
        p1.innerHTML = "Set component type complexities:";
        form.appendChild(p1);
        let table1 = document.createElement("table");
        for (let CType in myALPHA) {
            let TR = document.createElement("tr");
            let td1 = document.createElement("td");
            let td2 = document.createElement("td");
            td1.innerHTML = CType;
            let input = document.createElement("input");
            input.type="number";
            input.min="0";
            input.max = "10";
            input.step="1";
            input.setAttribute("value",myALPHA[CType]);
            input.setAttribute("data-ctype", CType);
            input.addEventListener("change", function() {
                myALPHA[this.dataset.ctype] = Number(this.value);
                console.log(myALPHA);
            });
            td2.appendChild(input);
            TR.appendChild(td1);
            TR.appendChild(td2);
            table1.appendChild(TR);
        }
        form.appendChild(table1);
        // generate GUI for interfaces
        let p2 = document.createElement("p");
        p2.innerHTML = "Set interfaces weight:";
        form.appendChild(p2);
        let table2 = document.createElement("table");
        for (let interf in myICC) {
            let TR = document.createElement("tr");
            let td1 = document.createElement("td");
            let td2 = document.createElement("td");
            td1.innerHTML = interf.replace(","," &harr; ");
            let input = document.createElement("input");
            input.type="number";
            input.min="0";
            input.step="0.05";
            input.setAttribute("value", myICC[interf]);
            input.setAttribute("data-interface", interf);
            input.addEventListener("change", function() {
                myICC[this.dataset.interface] = Number(this.value);
            });
            td2.appendChild(input);
            TR.appendChild(td1);
            TR.appendChild(td2);
            table2.appendChild(TR);
        }
        form.appendChild(table2);
        document.getElementById("step0_2").style.display = "none";
        document.getElementById("step1_2").style.display = "block";
    });

    document.getElementById("btnPrevious0_2").addEventListener("click", function(){
        document.getElementById("step0_2").style.display = "block";
        document.getElementById("step1_2").style.display = "none";
    });

    document.getElementById("btnNext1_2").addEventListener("click", function() {
        let input = document.getElementById("numClusters");
        let configs = JSON.parse(INSTANCES.value);
        input.setAttribute("max", configs.length);
        if (Number(input.value) > configs.length) {
            input.value = configs.length;
        } 
        computeAndDrawClusters();
        document.getElementById("step1_2").style.display = "none";
        document.getElementById("step2_2").style.display = "block";
    });

    document.getElementById("btnPrevious1_2").addEventListener("click", function(){
        document.getElementById("step1_2").style.display = "block";
        document.getElementById("step2_2").style.display = "none";
    });

    document.getElementById("numClusters").addEventListener("change", computeAndDrawClusters);
    document.querySelectorAll('[name="radDistance"]').forEach(e => e.addEventListener("change", computeAndDrawClusters))
    document.getElementById("cvsClusters").addEventListener("click", clickOnCanvas);

    function computeAndDrawClusters() {
        let cvs = document.getElementById("cvsClusters");
        let ctx = cvs.getContext("2d");
        cvs.width = ctx.width = Math.max(window.innerWidth * 0.5, 600);
        cvs.height = ctx.height = Math.max(window.innerHeight * 0.6, 400);
        cvs.style.width = cvs.width + "px";
        cvs.style.height = cvs.height + "px";
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, ctx.width, ctx.height);

        let tabConfigs = JSON.parse(INSTANCES.value);
        let t = tabConfigs.map(function(c) {
            return { 
                "complexity": returnExports2.complexity(c, null, myALPHA, myICC), 
                "score": returnExports2.score(c)
            };
        });
        let distanceFuncName = document.querySelector('[name="radDistance"]:checked').value;
        let nbClusters = Math.min(Number(document.getElementById("numClusters").value), tabConfigs.length);
        let clusters = returnExports2.KMeans(t, nbClusters, distanceFuncName);
        // plot clusters
        plotClusters(ctx, clusters, nbClusters, t);
    }


    let points = [];

    function plotClusters(ctx, clusters, nbClusters, configs) {
        let [ minX, maxX, minY, maxY ] = determineBounds(configs);
        let colors = computeColors(nbClusters);
        let coeffX = (ctx.width - 40) / (maxX - minX);   // 20px of horizontal margin
        let coeffY = (ctx.height - 40) / (maxY - minY);  // 20px of vertical margin
        ctx.strokeStyle = "black";
        points = [];
        for (let i=0; i < configs.length; i++) {
            let config = configs[i];
            let x = 20 + (config.complexity - minX) * coeffX;
            let y = 20 + (getYfromScore(config.score) - minY) * coeffY;
            ctx.fillStyle = colors[clusters[i]];    // color determined by cluster
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.arc(x, y, ctx.width/100, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fill();
            points.push([x,y,configs[i]]);
        }

    }

    function clickOnCanvas(event) {
        let x = event.pageX - event.target.offsetLeft;
        let y = event.pageY - event.target.offsetTop;

        for (let i=0; i < points.length; i++) {
            if (distanceTo(x,y,points[i][0],points[i][1]) < Number(event.target.width) / 100) {
                afficherInfosConfig(i);
                return ;
            }
        }

    }
    function distanceTo(x1, y1, x2, y2) {
        return Math.sqrt((x1-x2)*(x1-x2)+(y1-y2)*(y1-y2));
    }
    function afficherInfosConfig(i) {
        let config = JSON.parse(INSTANCES.value)[i];
        alert(config);
    }

    function determineBounds(configs) {
        let maxX, maxY;
        let minX = maxX = configs[0].complexity;
        let minY = maxY = getYfromScore(configs[0].score);
        for(let i=1; i < configs.length; i++) {
            let x = configs[i].complexity;
            let y = getYfromScore(configs[i].score);
            if (x < minX) {
                minX = x;
            }
            else if (x > maxX) {
                maxX = x;
            }
            if (y < minY) {
                minY = y;
            }
            else if (y > maxY) {
                maxY = y;
            }
        }
        console.log({minX,maxX,minY,maxY});
        return [ minX, maxX, minY, maxY ];
    }


    function getYfromScore(score) {
        let nb = 0, sum = 0;
        for (let p in score) {
            sum += score[p];
            nb++;
        }
        return nb > 0 ? sum / nb : 0;
    }

    function computeColors(nb) {
        let ret = [];
        for (let i=0; i < nb; i++) {
            ret[i] = `hsl(${360 * i / nb | 0}deg, 100%, 50%)`;
        }
        console.log(ret)
        return ret;
    }

});

