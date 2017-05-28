class GazeInteraction {
    constructor(camera, domElement) {
        this.raycaster  = new THREE.Raycaster();
        this.mouse      = new THREE.Vector2();
        this.camera     = camera;
        this.objects    = [];
        this.intsurf    = [];
        this.domElement = domElement;
        
        var geometry = new THREE.SphereBufferGeometry(3, 16);
        var cursorMaterial = new THREE.MeshBasicMaterial({color: 0xFFFFFF});
        this.representation = new THREE.Mesh(geometry, cursorMaterial);
        
        domElement.addEventListener("mousemove", this.onMouseMove.bind(this));
        domElement.addEventListener("vrdisplaypresentchange", this.vrPresentationChange.bind(this));
    }
    
    vrPresentationChange() {
        if(vrDisplay.isPresenting) {
            this.mouse.set(0,0);
        }
    }
    
    onMouseMove( event ) {
        // calculate mouse position in normalized device coordinates
        // (-1 to +1) for both components
        if(!vrDisplay.isPresenting) {
            this.mouse.x =   (event.clientX / this.domElement.clientWidth  ) * 2 - 1;
            this.mouse.y = - (event.clientY / this.domElement.clientHeight ) * 2 + 1;
        }
    }
    
    animate(t, dt) {
        for(var i = 0; i < this.objects.length; i++) {
            if(this.objects[i].viewFrom) {
                this.objects[i].viewFrom(this.camera);
            }
            if(this.objects[i].animate) {
                this.objects[i].animate(t, dt);
            }
        }
        this.interact();
    }
    
    interact() {
        this.raycaster.setFromCamera( this.mouse, this.camera );

        // calculate objects intersecting the picking ray
        var intersects = this.raycaster.intersectObjects(this.intsurf, true);
        for (var i = 0; i < intersects.length; i++) {
            var obj = intersects[ i ].object;
            if(obj.userData.onMouseWithin) {
                if(obj.userData.onMouseEnter && !obj.userData.isWithin) {
                    obj.userData.onMouseEnter(intersects[ i ]);
                    obj.userData.isWithin = true;
                }
                obj.userData.onMouseWithin(intersects[ i ]);
            }
        }
        if(!intersects.length) {
            this.hideCursor();
            for(var i = 0; i < this.intsurf.length; i++) {
                this.intsurf[i].userData.isWithin = false;
            }
        }
    }
    
    add(obj) {
        this.intsurf.push(obj.interactionSurface);
        this.objects.push(obj);
    }
    
    addCursor(mesh, callback) {
        var gaze = callback ?
            new GazeCursorWithAnimation(this, callback) :
            new GazeCursorWithDot(this);
        mesh.add(gaze.representation);
        this.add(gaze);
        return gaze;
    }
    
    showCursor(point) {
        this.representation.visible = true;
        this.representation.position.copy(point);
    }
    
    hideCursor() {
        this.representation.visible = false;
    }
}

class GazeCursor {
    constructor(interactionObject) {
        this.representation = new THREE.Object3D();
        this.interactionObject = interactionObject;
        
        this.planeSize  = 160;
        
        // Materials
        var invisibleMaterial = new THREE.MeshBasicMaterial({visible: false});
        
        // The interaction surface
        var geometry = new THREE.PlaneBufferGeometry(this.planeSize,this.planeSize);
        this.interactionSurface = new THREE.Mesh(geometry, invisibleMaterial);
        this.representation.add(this.interactionSurface);
                
        this.interactionSurface.userData.onMouseWithin = this.onMouseWithin.bind(this);
        
        this.cameraPosition = new THREE.Vector3();
    }
    
    onMouseWithin(intersection) {
        this.interactionObject.showCursor(intersection.point);
    }
    
    viewFrom(camera) {
        camera.getWorldPosition(this.cameraPosition);
        this.representation.worldToLocal(this.cameraPosition);
        this.interactionSurface.lookAt(this.cameraPosition);
        this.cameraPosition.multiplyScalar(0.5);
        this.interactionSurface.position.copy(this.cameraPosition);
    }
}

class GazeCursorWithDot extends GazeCursor {
    constructor(interactionObject) {
        super(interactionObject);
        this.dotSize  = 3;
        
        var geometry = new THREE.SphereBufferGeometry(1);
        var material = new THREE.MeshBasicMaterial({color: 0xFFFFFF});
        this.dot = new THREE.Mesh(geometry, material);
        this.dot.scale.set(this.dotSize,this.dotSize,this.dotSize);
        this.interactionSurface.add(this.dot);
    }
}

class GazeCursorWithAnimation extends GazeCursorWithDot {
    constructor(interactionObject, callback) {
        super(interactionObject);
        this.callback = callback;        
        
        this.growHesitation = 0.5;
        this.growTime       = 0.1;
        this.bigSize        = 20;
    }
    
    onMouseWithin(intersection) {
        super.onMouseWithin(intersection);
        var uv_dx = intersection.uv.x - 0.5;
        var uv_dy = intersection.uv.y - 0.5;
        var dist  = Math.sqrt(uv_dx*uv_dx + uv_dy*uv_dy) * this.planeSize;
        if(dist < this.bigSize) {
            this.grow();
        } else {
            this.reset();
        }
    }
    
    grow() {
        if(!this.animationFunc) {
            this.animationFunc = this.animationStart.bind(this);
        }
    }
    
    reset() {
        this.animationFunc = null;
        this.dot.scale.set(this.dotSize,this.dotSize,this.dotSize);
    }
    
    animate(t, dt) {
        if(this.animationFunc) {
            this.animationFunc(t, dt);
        }
    }
    
    animationStart(t, dt) {
        this.growing = t + this.growHesitation;
        this.animationFunc = this.animationGrowing.bind(this);
    }
    
    animationGrowing(t, dt) {
        var e = Math.max(0, (t - this.growing)/this.growTime);
        if(e < 1) {
            var s = this.dotSize + e * (this.bigSize - this.dotSize);
            this.dot.scale.set(s,s,s);
        } else {
            this.dot.scale.set(this.dotSize,this.dotSize,this.dotSize);
            this.animationFunc = this.animationLast.bind(this);
        }
    }
    
    animationLast(t, dt) {
        if(this.callback) {
            this.callback();
        }
        this.animationFunc = this.animationWaiting.bind(this);
    }
    
    animationWaiting(t, dt) {
        // Do nothing until reset is called.
    }
}