// --- JAVASCRIPT LOGIC (Copy this into main.js) ---
// --- Configuration Constants ---
const NUM_PARTICLES = 20000;
const FIELD_SCALE = 50;
const FLOW_SPEED = 0.005;
const PARTICLE_SPEED_MULTIPLIER = 0.5;
const BOUNDARY_SIZE = 500;

// --- Predefined Vector Fields (Static Data) ---
const PREBUILT_FIELDS = [
    { 
        name: '1. Simple Rotation (Z-Axis)', 
        vx: '-y * 0.1', 
        vy: 'x * 0.1', 
        vz: '0' 
    },
    { 
        name: '2. Linear Expansion (Source/Sink)', 
        vx: 'x * 0.1', 
        vy: 'y * 0.1', 
        vz: 'z * 0.1' 
    },
    { 
        name: '3. Shearing Flow (X-Z plane)', 
        vx: 'z * 0.1', 
        vy: '0', 
        vz: 'x * 0.1' 
    },
    { 
        name: '4. Attractor (Cube edges)', 
        vx: '-Math.sin(x) * 10', 
        vy: '-Math.sin(y) * 10', 
        vz: '-Math.sin(z) * 10' 
    },
    { 
        name: '5. Dynamic Swirl (Time-dependent)', 
        vx: 'Math.sin(ny + time * 0.5) * 2', 
        vy: 'Math.cos(nx + time * 0.5) * 2', 
        vz: 'Math.sin(nz + time * 0.5) * 1.5' 
    },
    {
        name: '6. Spiral Vortex to Center (Rotation + Sink)',
        vx: '(-y * 0.1 - x * 0.05)',
        vy: '(x * 0.1 - y * 0.05)',
        vz: 'z * 0.02'
    },
    {
        name: '7. Central Attraction (Harmonic Oscillator)',
        vx: '-x * 0.05',
        vy: '-y * 0.05',
        vz: '-z * 0.05'
    },
    {
        // Cleaned up text for professional appearance
        name: '8. Spherical Outflow (Central Source)',
        vx: 'nx / (nx*nx + ny*ny + nz*nz + 0.5) * 5',
        vy: 'ny / (nx*nx + ny*ny + nz*nz + 0.5) * 5',
        vz: 'nz / (nx*nx + ny*ny + nz*nz + 0.5) * 5'
    },
    // --- NEW FUNCTIONS ADDED BELOW ---
    {
        name: '9. 3D Helix (Tornado)',
        vx: '-y * 0.15',
        vy: 'x * 0.15',
        vz: 'Math.sin(time) * 0.3' // Rotates around Z, with a slight vertical pump
    },
    {
        name: '10. Hyperbolic Saddle Point',
        vx: 'x * 0.2',
        vy: '-y * 0.2',
        vz: '0' // Expands on X-axis, collapses on Y-axis
    },
    {
        name: '11. Sinusoidal Standing Wave',
        vx: 'Math.sin(nz * 20 + time * 0.2) * 5',
        vy: 'Math.cos(nx * 20 + time * 0.2) * 5',
        vz: 'Math.sin(ny * 20 + time * 0.2) * 5' // Complex 3D rippling motion
    }
];

/**
 * The main class that encapsulates all Three.js simulation logic.
 */
class VectorFieldApp {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.particles = null;
        this.positions = null;
        this.clock = null;
        this.userFieldFunction = null; // Dynamically generated vector field function
    }

    /**
     * Initializes the Three.js scene, camera, and controls.
     */
    init() {
        // 1. Scene Setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x0d1117, 500, 2000); 

        // 2. Camera Setup
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 1, 3000); 
        this.camera.position.z = 800;

        // 3. Renderer Setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('scene-container').appendChild(this.renderer.domElement);

        // 4. Controls Setup
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 2500;
        this.controls.minDistance = 50;

        // 5. Clock for timing
        this.clock = new THREE.Clock();

        // 6. Setup objects
        this.initParticles();
        this.addCoordinateAxes();
        this.addBoundingBox();

        // 7. Setup UI and load initial field
        this.setupUIAndField();

        // 8. Event Listener for responsiveness
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    /**
     * Adds 3D coordinate axes to the scene.
     */
    addCoordinateAxes() {
        const axesHelper = new THREE.AxesHelper(BOUNDARY_SIZE * 1.05); 
        this.scene.add(axesHelper);
    }
    
    /**
     * Adds a wireframe bounding box to the scene.
     */
    addBoundingBox() {
        const boxSize = BOUNDARY_SIZE * 2;
        const geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.3 
        });
        const line = new THREE.LineSegments(edges, lineMaterial);
        this.scene.add(line);
    }

    /**
     * Creates the particle system (Points).
     */
    initParticles() {
        const geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(NUM_PARTICLES * 3);
        
        // Initialize particles randomly across the boundary
        this.resetParticlePositions();

        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

        const material = new THREE.PointsMaterial({ 
            color: 0x58a6ff, 
            size: 1.5,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.8
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    /**
     * Resets all particle positions to be randomly spread across the simulation space.
     * This prevents clustering issues when switching fields.
     */
    resetParticlePositions() {
        for (let i = 0; i < NUM_PARTICLES * 3; i += 3) {
            this.positions[i] = (Math.random() - 0.5) * BOUNDARY_SIZE * 2;
            this.positions[i + 1] = (Math.random() - 0.5) * BOUNDARY_SIZE * 2;
            this.positions[i + 2] = (Math.random() - 0.5) * BOUNDARY_SIZE * 2;
        }
        // CRITICAL: Tell Three.js the positions array has changed
        if (this.particles && this.particles.geometry && this.particles.geometry.attributes.position) {
            this.particles.geometry.attributes.position.needsUpdate = true;
        }
    }

    /**
     * Parses user input into a dynamic function for vector calculation.
     */
    parseAndSetField(vxString, vyString, vzString) {
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = ''; 

        try {
            // Combine the three components into the execution block
            const codeToExecute = 
                `const time = t; 
                    const nx = x / FIELD_SCALE;
                    const ny = y / FIELD_SCALE;
                    const nz = z / FIELD_SCALE;

                    // User defined components (wrapped in parentheses for safety):
                    const vx = (${vxString});
                    const vy = (${vyString});
                    const vz = (${vzString});

                    return new THREE.Vector3(vx || 0, vy || 0, vz || 0);`;

            // Create the dynamic function
            this.userFieldFunction = new Function('x', 'y', 'z', 't', 'FIELD_SCALE', 'THREE', codeToExecute);
            
            // Test the function once to catch immediate syntax errors
            this.userFieldFunction(1, 1, 1, 0, FIELD_SCALE, THREE);

            // Reset particle positions immediately after applying a new valid field
            this.resetParticlePositions(); 

            errorMessage.textContent = 'Field applied successfully!';
            errorMessage.style.color = '#34d399';
        } catch (e) {
            console.error("Vector Field Parse Error:", e);
            this.userFieldFunction = null; 
            errorMessage.textContent = 'Error: Invalid formula. Check syntax. (' + e.message.substring(0, 50) + '...)';
            errorMessage.style.color = '#f87171';
        }
    }
    
    /**
     * Calculates the vector field at a given point using the dynamic function.
     */
    getVectorField(x, y, z, time) {
        if (this.userFieldFunction) {
            try {
                return this.userFieldFunction(x, y, z, time, FIELD_SCALE, THREE);
            } catch (e) {
                return new THREE.Vector3(0, 0, 0); 
            }
        }
        return new THREE.Vector3(0, 0, 0);
    }

    /**
     * Sets up the initial UI state and event listeners.
     */
    setupUIAndField() {
        const vxInput = document.getElementById('vxInput');
        const vyInput = document.getElementById('vyInput');
        const vzInput = document.getElementById('vzInput');
        const applyButton = document.getElementById('applyField');
        const prebuiltSelector = document.getElementById('prebuiltSelector'); 
        const controlsWrapper = document.getElementById('controls-wrapper');
        const controlsHeader = document.getElementById('controls-header');
        
        // 1. Populate the Prebuilt Selector
        PREBUILT_FIELDS.forEach((field, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = field.name;
            prebuiltSelector.appendChild(option);
        });
        
        // Function to load a field by its index
        const loadField = (index) => {
            const field = PREBUILT_FIELDS[index];
            if (field) {
                vxInput.value = field.vx.trim();
                vyInput.value = field.vy.trim();
                vzInput.value = field.vz.trim();
                this.applyCurrentField(vxInput.value, vyInput.value, vzInput.value); 
            }
        };
        
        // Function to get current values and apply
        this.applyCurrentField = (vx, vy, vz) => {
            this.parseAndSetField(vx || vxInput.value, vy || vyInput.value, vz || vzInput.value);
        };

        // 2. Set initial field (first in list: Simple Rotation)
        loadField(0);

        // 3. Add event listeners
        applyButton.addEventListener('click', () => this.applyCurrentField());
        prebuiltSelector.addEventListener('change', (e) => loadField(e.target.value));
        
        [vxInput, vyInput, vzInput].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyCurrentField();
                }
            });
        });
        
        // --- Collapsible Logic ---
        controlsHeader.addEventListener('click', () => {
            controlsWrapper.classList.toggle('collapsed');
        });
        
        controlsWrapper.classList.add('collapsed'); 
    }
    
    /**
     * Main animation loop.
     */
    animate() {
        const time = this.clock.getElapsedTime() * FLOW_SPEED;

        // Update particle positions
        for (let i = 0; i < NUM_PARTICLES * 3; i += 3) {
            let x = this.positions[i];
            let y = this.positions[i + 1];
            let z = this.positions[i + 2];

            // 1. Calculate velocity vector from the field
            const velocity = this.getVectorField(x, y, z, time);

            // 2. Apply velocity
            x += velocity.x * PARTICLE_SPEED_MULTIPLIER;
            y += velocity.y * PARTICLE_SPEED_MULTIPLIER;
            z += velocity.z * PARTICLE_SPEED_MULTIPLIER;

            // 3. Boundary Check (Wrap particles that leave the field)
            if (Math.abs(x) > BOUNDARY_SIZE || Math.abs(y) > BOUNDARY_SIZE || Math.abs(z) > BOUNDARY_SIZE) {
                // Reset particle to a random position near the center
                x = (Math.random() - 0.5) * BOUNDARY_SIZE;
                y = (Math.random() - 0.5) * BOUNDARY_SIZE;
                z = (Math.random() - 0.5) * BOUNDARY_SIZE;
            }

            // 4. Update the buffer geometry
            this.positions[i] = x;
            this.positions[i + 1] = y;
            this.positions[i + 2] = z;
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;

        // Render the scene
        this.controls.update(); 
        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(this.animate.bind(this));
    }
    
    /**
     * Handles window resizing.
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// --- Startup ---
window.onload = function () {
    const app = new VectorFieldApp();
    app.init();
    app.animate();
};