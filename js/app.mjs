import * as THREE from 'https://unpkg.com/three@0.124.0/build/three.module.js';
import {OrbitControls} from 'https://unpkg.com/three@0.124.0/examples/jsm/controls/OrbitControls.js';

import {Sun, Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune} from './material.mjs';

const materials = new Array();
materials.push(Sun.mesh, Mercury.mesh, Venus.mesh, Earth.mesh, Mars.mesh, Jupiter.mesh, Saturn.mesh, Uranus.mesh, Neptune.mesh);

function getData(callback)
{
    // Get solar data
    $.getJSON("https://api.le-systeme-solaire.net/rest/bodies/", "filter[]=englishName,eq,Sun", function(data)
    {
        // Correct order of bodies
        var index = [0, 5, 8, 7, 4, 3, 6, 1, 2]
        var unsorted_bodies = new Array();
        var bodies = new Array();

        var sun = data.bodies[0];

        delete sun["alternativeName"];
        delete sun["aroundPlanet"];
        delete sun["dimension"];
        delete sun["discoveredBy"];
        delete sun["discoveryDate"];
        delete sun["id"];
        delete sun["isPlanet"];
        delete sun["moons"];
        delete sun["name"];
        delete sun["rel"];
        delete sun["vol"];

        unsorted_bodies.push(sun);
        
        // Get planetary data
        $.getJSON("https://api.le-systeme-solaire.net/rest/bodies/", "filter[]=isPlanet,neq,false", function(data)
        {
            // Remove the residual error data
            data.bodies.splice(0, 1);
            data.bodies.splice(0, 1);
            data.bodies.splice(1, 1);
            data.bodies.splice(2, 1);
            data.bodies.splice(2, 1);
            
            for (let i = 0; i < data.bodies.length; i++)
            {
                var body = data.bodies[i];
                var key = Object.keys(body);

                for (let property of key)
                {
                    // Remove empty properties
                    if (body[property] == "" || body[property] == null)
                    {
                        delete body[property];
                    }
                    // Remove unwanted properties
                    else if (property == "id" || property == "isPlanet" || property == "name" || property == "rel")
                    {
                        delete body[property];
                    }
                    // Replace moon objects with number of moons
                    else if (property == "moons")
                    {
                        body[property] = body[property].length
                    }
                }
                
                unsorted_bodies.push(body);
            }

            // Sort bodies according to index
            bodies = index.map(i => unsorted_bodies[i]);

            callback(bodies)
        }); 
    });
}

function initialiseScene(bodies)
{
    // Create scene
    const scene = new THREE.Scene();

    // Create Orthographic camera
    const camera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, -10000, 10000);

    camera.position.x = 0;
    camera.position.y = 350;
    camera.position.z = 350;

    camera.rotation.x = -0.15;

    camera.zoom = 0.4;

    scene.add(camera);
    console.log(camera);

    // Create renderer
    const renderer = new THREE.WebGLRenderer({antialias:true});

    // Set window size to render app
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Add renderer element to document
    document.body.appendChild(renderer.domElement);

    // Instantiate Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);

    // Create meshes and set initial positions
    var meshes = modelBodies(bodies);
    var positions = setInitPositions(meshes);

    for (let i = 0; i < meshes.length; i++)
    {
        scene.add(meshes[i]);
    }

    // Set Sun's position individually
    // Offset to model perihelion/aphelion
    meshes[0].position.set(-20, 0, 0);
    
    var majorRadii = getMajorRadii(meshes);

    function animate()
    {
        updatePositions(positions, majorRadii, meshes);
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    
    animate();

    makeButtons(bodies, meshes);
}

function getDataCallback(bodies)
{
    initialiseScene(bodies);
}

getData(getDataCallback);

function modelBodies(bodies)
{
    var meshes = new Array();
    var radius;
    var name_formatted;
    
    for (let i = 0; i < bodies.length; i++)
    {
        switch(bodies[i].englishName)
        {
            case "Sun":
                radius = 160.0;
                name_formatted = "sun";
                break;
            case "Mercury":
                radius = 4.0;
                name_formatted = "MeRcury";
                break;
            case "Venus":
                radius = 7.0;
                name_formatted = "Venus";
                break;
            case "Earth":
                radius = 8.0;
                name_formatted = "eARtH";
                break;
            case "Mars":
                radius = 5.0;
                name_formatted = "MARs";
                break;
            case "Jupiter":
                radius = 32.0;
                name_formatted = "jupiteR";
                break;
            case "Saturn":
                radius = 28.0;
                name_formatted = "sAtuRn";
                break;
            case "Uranus":
                radius = 20.0;
                name_formatted = "uRAnus";
                break;
            case "Neptune":
                radius = 19.0;
                name_formatted = "neptune";
                break;
        }
        
        var bodyGeo = new THREE.SphereBufferGeometry(radius, 100, 100, 0, 6.3, 0, 3.2);
        var bodyMat = new THREE.MeshBasicMaterial({color: materials[i]});
        var body = new THREE.Mesh(bodyGeo, bodyMat);
        body.name = bodies[i].englishName;
        body.name_formatted = name_formatted;
        meshes.push(body);
    }

    return meshes;
}

function setInitPositions(meshes)
{
    var majorRadii = new Array();
    majorRadii = getMajorRadii(meshes);
    var initPositions = getInitPositions(majorRadii);
    return initPositions;
}

function getMajorRadii(meshes)
{
    var majorRadii = new Array();
    var majorRadius = 0; 
    
    // Do not include Sun
    for (let i = 1; i < meshes.length; i++)
    {
        // Space planets by diameter of previous neighbour plus 200
        majorRadius += (meshes[i - 1].geometry.parameters.radius * 2) + 200
        meshes[i].position.set(majorRadius, 0, 0);
        majorRadii.push(majorRadius);
     }

    return majorRadii;
}

function getInitPositions(majorRadii)
{
    var initPositions = new Array();
    var coordinates;

    // Only get positions for planets so loop against majorRadii [8]
    for (let i = 0; i < majorRadii.length; i++)
    {
        var isNegative;
        var xCoord;
        var zCoord;
        
        // Get random x value and use to find z
        // -major radius <= x <= major radius
        xCoord = Math.floor((Math.random() * majorRadii[i]) + 1);
        
        // if math.random() == 1
        // multiply xcoord by 1
        // Else
        // Multiply xCoord by -1
        xCoord *= Math.floor((Math.random() * 2)) == 1 ? 1 : -1;

        // Returns either 1 or 0
        isNegative = Math.floor((Math.random() * 2)) == 1 ? true : false;
        zCoord = ellipseEq(xCoord, majorRadii[i], isNegative);

        coordinates = {xCoord, zCoord};
        initPositions.push(coordinates);
    }
    
    return initPositions;
}

function ellipseEq(xCoord, majorRadius, isNegative)
{
    var zCoord;
    var minorRadius;

    // Arbitrary ratio of 10:9
    minorRadius = ((majorRadius / 10) * 9);

    // z = b^2(1 - (x^2)/(a^2))
    var equation = (Math.pow(minorRadius, 2)) * (1 - (Math.pow(xCoord, 2)) / (Math.pow(majorRadius, 2)));

    // Full equation involves square root
    // Prepare for negative values
    if (equation < 0)
    {
        equation *= -1;
        // z = sqrt(b^2(1 - (x^2)/(a^2)))
        zCoord = Math.sqrt(equation);
        zCoord *= -1;
    }
    else
    {
        // z = sqrt(b^2(1 - (x^2)/(a^2)))
        zCoord = Math.sqrt(equation);
    }

    if (isNegative)
    {
        zCoord *= -1;
    }

    return zCoord;
}

function updatePositions(positions, majorRadii, meshes)
{
    var coordinates;

    // Let innermost planets orbit faster
    const increment = [2.00, 1.75, 1.50, 1.25, 1.00, 0.75, 0.50, 0.25];

    // Only calculate positions for planets so loop against majorRadii [8]
    for (let i = 0; i < majorRadii.length; i++)
    {
        var remainder;
        var xCoord = positions[i].xCoord;
        var zCoord = positions[i].zCoord;

        var relative_increment = relativeIncrement(majorRadii[i], xCoord, increment[i]);
        
        if (xCoord > 0)
        {
            if (zCoord > 0)
            {
                // Don't increment past major radius
                if (relative_increment > (majorRadii[i] - xCoord))
                {
                    remainder = majorRadii[i] - xCoord;
                    xCoord += remainder;
                    remainder = relative_increment - remainder;
                    xCoord -= remainder;
                    zCoord = ellipseEq(xCoord, majorRadii[i], true);
                }

                else
                {
                    xCoord += relative_increment;
                    zCoord = ellipseEq(xCoord, majorRadii[i], false);
                }
            }

            else if (zCoord == 0)
            {
                xCoord -= relative_increment;
                zCoord = ellipseEq(xCoord, majorRadii[i], true);
            }

            else if (zCoord < 0)
            {
                xCoord -= relative_increment;
                zCoord = ellipseEq(xCoord, majorRadii[i], true);
            }
        }

        else if (xCoord == 0)
        {
            if (zCoord > 0)
            {
                xCoord += relative_increment;
                zCoord = ellipseEq(xCoord, majorRadii[i], false);
            }

            else if (zCoord < 0)
            {
                xCoord -= relative_increment;
                zCoord = ellipseEq(xCoord, majorRadii[i], true);
            }
        }

        else if (xCoord < 0)
        {
            if (zCoord > 0)
            {
                xCoord += relative_increment;
                zCoord = ellipseEq(xCoord, majorRadii[i], false);
            }

            else if (zCoord == 0)
            {
                xCoord += relative_increment;
                zCoord = ellipseEq(xCoord, majorRadii[i], false);
            }

            else if (zCoord < 0)
            {
                // Don't increment past major radius
                if (relative_increment > (majorRadii[i] - Math.abs(xCoord)))
                {
                    remainder = majorRadii[i] - Math.abs(xCoord);
                    xCoord -= remainder;
                    remainder = relative_increment - remainder;
                    xCoord += remainder;
                    zCoord = ellipseEq(xCoord, majorRadii[i], false);
                }

                else
                {
                    xCoord -= relative_increment;
                    zCoord = ellipseEq(xCoord, majorRadii[i], true);
                }
            }
        }
        
        coordinates = {xCoord, zCoord};
        positions[i] = coordinates;
    }

    // Only set positions for planets so loop against majorRadii [8]
    for (let i = 0; i < majorRadii.length; i++)
    {
        meshes[i + 1].position.set(positions[i].xCoord, 0, positions[i].zCoord);
    }
}

// Increase absolute value of x more gradually at extremities
function relativeIncrement(major_radius, x_coord, increment)
{
    var relative_increment;
    x_coord = Math.abs(x_coord);
/*
    // Limit smallest increment to 0.1
    if (major_radius - x_coord <= x_coord / major_radius + 1)
    {
        relative_increment = (major_radius - x_coord) / major_radius;
        return relative_increment;
    }
*/
    if (x_coord + 0.1 >= major_radius)
    {
        relative_increment = 0.01;
        relative_increment = relative_increment + increment;
        return relative_increment
    }

    else
    {
        relative_increment = (major_radius - x_coord) / major_radius;
        relative_increment = relative_increment + increment;
        return relative_increment;
    }
}

function makeButtons(bodies, meshes)
{
    var button;
    var container = document.getElementById("buttons");
    var name;
    var name_formatted;
    
    for (let i = 0; i < bodies.length; i++)
    {
        name = bodies[i].englishName;
        name_formatted = meshes[i].name_formatted;
        button = document.createElement("button");
        button.type = "button";
        button.id = name;
        button.innerHTML = name_formatted;
        button.onclick = function() {showTable(bodies[i])};
        container.appendChild(button);
    }
}

function showTable(body)
{
    var propertyName;
    var propertyValue;
    var propertyExponent;
    var units;
    var unitsExponent;

    var table = document.querySelector("table");
    var keys = Object.keys(body);

    // Clear previous table
    table.innerHTML = "";   

    for (let property of keys)
    {
        switch(property)
        {
            case "englishName":
                propertyName = "Name";
                propertyValue = body.englishName;
                units = "";
                break;
            case "moons":
                if (body.moons == null)
                {
                    break;
                }
                propertyName = "Moons";
                propertyValue = body.moons;
                units = "";
                break;
            case "semimajorAxis":
                propertyName = "Semi-major axis";
                propertyValue = body.semimajorAxis;
                units = " m";
                break;
            case "perihelion":
                propertyName = "Perihelion";
                propertyValue = body.perihelion;
                units = " m";
                break;
            case "aphelion":
                propertyName = "Aphelion";
                propertyValue = body.aphelion;
                units = " m";
                break;
            case "eccentricity":
                propertyName = "Eccentricity";
                propertyValue = body.eccentricity;
                units = "";
                break;
            case "inclination":
                propertyName = "Inclination";
                propertyValue = body.inclination;
                units = "&deg;";
                break;
            case "mass":
                propertyName = "Mass";
                propertyValue = body.mass.massValue;
                propertyExponent = body.mass.massExponent;
                units = " kg";
                break;
            case "vol":
                if (body.vol == null)
                {
                    break;
                }
                propertyName = "Volume";
                propertyValue = body.vol.volValue;
                propertyExponent = body.vol.volExponent;
                units = " km";
                unitsExponent = "3";
                break;
            case "density":
                propertyName = "Density";
                propertyValue = body.density;
                units = " g/cm";
                unitsExponent = "3";
                break;
            case "gravity":
                propertyName = "Gravity";
                propertyValue = body.gravity;
                units = " m/s";
                unitsExponent = "2";
                break;
            case "escape":
                propertyName = "Escape velocity";
                propertyValue = body.escape;
                units = " m/s";
                break;
            case "meanRadius":
                propertyName = "Mean radius";
                propertyValue = body.meanRadius;
                units = " km";
                break;
            case "equaRadius":
                propertyName = "Equatorial radius";
                propertyValue = body.equaRadius;
                units = " km";
                break;
            case "polarRadius":
                propertyName = "Polar radius";
                propertyValue = body.polarRadius;
                units = " km";
                break;
            case "flattening":
                propertyName = "Flattening";
                propertyValue = body.flattening;
                units = "";
                break;
            case "sideralOrbit":
                propertyName = "Sidereal orbit";
                propertyValue = body.sideralOrbit;
                units = " d";
                break;
            case "sideralRotation":
                propertyName = "Sidereal rotation";
                propertyValue = body.sideralRotation;
                units = " h";
                break;
            case "axialTilt":
                propertyName = "Axial tilt";
                propertyValue = body.axialTilt;
                units = "&deg;";
                break;
            case "discoveredBy":
                propertyName = "Discoverer";
                propertyValue = body.discoveredBy;
                units = "";
                break;
            case "discoveryDate":
                propertyName = "Discovered";
                propertyValue = body.discoveryDate;
                units = "";
                break;
            default:
                break;
        }

        var row = table.insertRow(); 
        var th = document.createElement("th");
        var key = document.createTextNode(propertyName);

        th.appendChild(key);
        row.appendChild(th);
        
        if (typeof body[property] === "object")
        {
            var td = document.createElement("td");
            var sup = document.createElement("sup");
            var exp = document.createTextNode(propertyExponent);
            var value = document.createTextNode(propertyValue);
            var unit = document.createTextNode(units);

            sup.appendChild(exp);
            td.appendChild(value);
            td.appendChild(sup);
            td.appendChild(unit);
        }
        else if (property == "inclination" || property == "axialTilt")
        {
            var td = document.createElement("td");
            var degrees = document.createElement("span");
            var value = document.createTextNode(propertyValue);
            
            degrees.innerHTML = units;

            td.appendChild(value);
            td.appendChild(degrees);
        }
        else
        {
            var td = document.createElement("td");
            var value = document.createTextNode(propertyValue);
            var unit = document.createTextNode(units);
            td.appendChild(value);
            td.appendChild(unit);
        }
        
        row.appendChild(td);
    }
}
