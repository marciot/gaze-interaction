/**
 *
 * @licstart
 *
 * Copyright (C) 2017 Marcio L Teixeira.
 *
 *
 * The JavaScript code in this page is free software: you can
 * redistribute it and/or modify it under the terms of the GNU Affero
 * General Public License (GNU AGPL) as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.  The code is distributed WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU AGPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * @licend
 *
 */
class GazeInteraction {
    constructor(camera, domElement) {
        this.raycaster   = new THREE.Raycaster();
        this.mouse       = new THREE.Vector2();
        this.camera      = camera;
        this.gazeTargets = [];
        this.intsurf     = [];
        this.domElement  = domElement;

        var geometry = new THREE.SphereBufferGeometry(0.005, 8);
        var cursorMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            depthTest: false, // Forces cursor to not be occluded.
            transparent: true // Forces object to be drawn after everything else
        });
        this.representation = new THREE.Mesh(geometry, cursorMaterial);

        domElement.addEventListener("mousemove",  this.onMouseMove.bind(this));
        domElement.addEventListener("touchstart", this.onTouchStart.bind(this));
        domElement.addEventListener("touchend",   this.onTouchEnd.bind(this));
        domElement.addEventListener("touchmove",  this.onTouchEvent.bind(this));
    }

    onTouchStart( event ) {
        this.immediate = true;
        this.onTouchEvent(event);
    }

    onTouchEnd( event ) {
        this.immediate = false;
        this.onTouchEvent(event);
    }

    onTouchEvent( event ) {
        this.setMouseLocation(event.touches[0].clientX, event.touches[0].clientY);
        event.preventDefault();
    }

    set immediate(value) {
        GazeTargetWithAnimation.growHesitation = value ? 0 : 0.5;
    }

    onMouseMove( event ) {
        this.setMouseLocation(event.clientX, event.clientY);
    }

    setMouseLocation(x, y) {
        // calculate mouse position in normalized device coordinates
        // (-1 to +1) for both components
        if(!vrDisplay.isPresenting) {
            this.mouse.x =   (x / this.domElement.clientWidth  ) * 2 - 1;
            this.mouse.y = - (y / this.domElement.clientHeight ) * 2 + 1;
        }
    }

    animate(t, dt) {
        for(var i = 0; i < this.gazeTargets.length; i++) {
            this.gazeTargets[i].viewFrom(this.camera);
            if(this.gazeTargets[i].animate) {
                this.gazeTargets[i].animate(t, dt);
            }
        }
        this.interact();
    }

    interact() {
        if(vrDisplay.isPresenting) {
            this.mouse.set(0,0);
        }
        this.raycaster.setFromCamera( this.mouse, this.camera );

        // calculate objects intersecting the picking ray
        var intersects = this.raycaster.intersectObjects(this.intsurf, true);
        for (var i = 0; i < intersects.length; i++) {
            var obj = intersects[ i ].object;
            if(!obj.userData.isWithin) {
                obj.userData.isWithin = true;
                if(obj.userData.onMouseEnter) {
                    obj.userData.onMouseEnter(intersects[ i ]);
                }
            }
            if(obj.userData.onMouseWithin) {
                obj.userData.onMouseWithin(intersects[ i ]);
            }
            // The mark value is used to check for when the
            // cursor leaves an object.
            obj.userData.mark = true;
        }

        // Set cursor on closest interaction surface, if any
        if(intersects.length) {
            this.showCursor(intersects[0].point);
        } else {
            this.hideCursor();
        }

        // Trigger mouse leave functions
        for(var i = 0; i < this.intsurf.length; i++) {
            var obj = this.intsurf[i];
            if(obj.userData.isWithin && !obj.userData.mark) {
                obj.userData.isWithin = false;
                if(obj.userData.onMouseLeave) {
                    obj.userData.onMouseLeave(this.intsurf[i]);
                }
            }
            obj.userData.mark = false;
        }
    }

    addInteraction(surf) {
        this.intsurf.push(surf);
    }

    addTarget(mesh, callback) {
        var gaze = callback ?
            new GazeTargetWithAnimation(callback) :
            new GazeTargetWithDot();
        mesh.add(gaze.representation);
        this.intsurf.push(gaze.interactionSurface);
        this.gazeTargets.push(gaze);
        return gaze;
    }

    showCursor(point) {
        this.representation.visible = true;
        this.representation.position.copy(point);
    }

    hideCursor() {
        this.representation.visible = false;
    }

    setClickSound(url, audioListener) {
        GazeTargetWithAnimation.setClickSound(url, audioListener);
    }
}

class GazeTarget {
    constructor() {
        this.representation = new THREE.Object3D();

        this.planeSize     = 0.160;

        // Materials
        var invisibleMaterial = new THREE.MeshBasicMaterial({visible: false});

        // The interaction surface
        var geometry = new THREE.PlaneBufferGeometry(this.planeSize, this.planeSize);
        this.interactionSurface = new THREE.Mesh(geometry, invisibleMaterial);
        this.representation.add(this.interactionSurface);

        this.cameraPosition = new THREE.Vector3();
    }
    
    viewFrom(camera) {
        camera.getWorldPosition(this.cameraPosition);
        this.representation.worldToLocal(this.cameraPosition);
        this.interactionSurface.lookAt(this.cameraPosition);
        if(this.floatDistance) {
            this.cameraPosition.normalize();
            this.cameraPosition.multiplyScalar(this.floatDistance);
            this.interactionSurface.position.copy(this.cameraPosition);
        }
    }
}

class GazeTargetWithDot extends GazeTarget {
    constructor() {
        super();
        this.dotSize  = 0.005;

        var geometry = new THREE.SphereBufferGeometry(1);
        var material = new THREE.MeshBasicMaterial({color: 0xFFFFFF});
        this.dot = new THREE.Mesh(geometry, material);
        this.dot.scale.set(this.dotSize,this.dotSize,this.dotSize);
        this.interactionSurface.add(this.dot);
    }
}

class GazeTargetWithAnimation extends GazeTargetWithDot {
    constructor(callback) {
        super();
        this.callback = callback;

        GazeTargetWithAnimation.growHesitation = 0.5;
        GazeTargetWithAnimation.growTime       = 0.1;
        this.bigSize        = 0.020;

        this.interactionSurface.userData.onMouseWithin = this.onMouseWithin.bind(this);
    }

    onMouseWithin(intersection) {
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
        this.growing = t + GazeTargetWithAnimation.growHesitation;
        this.animationFunc = this.animationGrowing.bind(this);
    }

    animationGrowing(t, dt) {
        var e = Math.max(0, (t - this.growing)/GazeTargetWithAnimation.growTime);
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
            if(GazeTargetWithAnimation.sound) {
                GazeTargetWithAnimation.sound.play();
            }
            this.callback();
        }
        this.animationFunc = this.animationWaiting.bind(this);
    }

    animationWaiting(t, dt) {
        // Do nothing until reset is called.
    }

    static setClickSound(url, audioListener) {
        if(!GazeTargetWithAnimation.sound) {
            var sound       = new THREE.Audio(audioListener || new THREE.AudioListener());
            var audioLoader = new THREE.AudioLoader();
            audioLoader.load(url, buffer => {
                sound.setBuffer(buffer);
                GazeTargetWithAnimation.sound = sound;
            });
        }
    }
}