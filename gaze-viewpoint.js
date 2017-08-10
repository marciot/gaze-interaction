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
class GazeViewpoint {
    constructor(camera, vrDisplay) {
        const defaultEyeHeight = 1.140;
        
        this.camera      = camera;
        this.vrDisplay   = vrDisplay;
        this.vrFrameData = new VRFrameData();
        this.position    = new THREE.Vector3();
        this.quaternion  = new THREE.Quaternion();
        
        this.forward = new THREE.Vector3();
        this.right   = new THREE.Vector3();
        this.up      = new THREE.Vector3();
        
        this.standingTransform = new THREE.Matrix4();
        this.updateStandingTransform();

        this.eyeHeight = defaultEyeHeight;
        this.standing  = true;
    }

    updateVectors() {
        this.camera.getWorldDirection(this.forward);
        this.right.copy(this.forward).cross(this.camera.up);
        this.up.copy(this.right).cross(this.forward);
    }

    setOrigin(position, isStanding) {
        this.camera.position.copy(position);
        this.position.copy(position);
        this.standing = isStanding;
        if(this.standing) {
            this.camera.position.applyMatrix4(this.standingTransform);
        }
    }
    
    scaledTranslation(offset, scale) {
        this.camera.position.addScaledVector(offset, scale);
        this.position.addScaledVector(offset, scale);
    }
    
    setLookAt(position) {
        this.camera.lookAt(position);
        this.quaternion.copy(this.camera.quaternion);
        this.resetPose();
        this.updateStandingTransform();
    }
    
    resetPose() {
        if(this.vrDisplay.resetPose) {
            this.vrDisplay.resetPose();
        }
        // Reset pose should zero out the coordinates, but this
        // does not seem to be happening in the Firefox. In this
        // case, we subtract out that offset ourselves.
        this.needPoseReset = true;
    }
    
    setLookRelative(offset) {
        var lookAt = new THREE.Vector3();
        this.camera.getWorldPosition(lookAt);
        lookAt.add(offset);
        this.setLookAt(lookAt);
    }
    
    setParams(params) {
        if(params.near) this.camera.near = params.near;
        if(params.far)  this.camera.far  = params.far;
        if(params.fov)  {
            this.camera.fov = params.fov;
            this.camera.updateProjectionMatrix();
        }
    }
    
    updateStandingTransform() {
        if(vrDisplay.stageParameters && vrDisplay.stageParameters.sittingToStandingTransform) {
            this.standingTransform.fromArray(vrDisplay.stageParameters.sittingToStandingTransform);
        }
    }
    
    poseResetFix() {
        // Reset pose should zero out the coordinates, but this
        // does not seem to be happening in the Firefox. In this
        // case, we subtract out that offset ourselves.
        if(this.needPoseReset && !this.standing) {
            this.needPoseReset = false;
            var p = new THREE.Vector3();
            console.log("Pose right after a poseReset (should be zero): ", p.x, p.y, p.z);
            p.fromArray(this.vrFrameData.pose.position);
            p.applyQuaternion(this.quaternion);
            this.position.sub(p);
            this.camera.position.set(0,0,0);
        }
    }
    
    update() {
        this.vrDisplay.getFrameData(this.vrFrameData);
        if (this.vrFrameData.pose && this.vrFrameData.pose.position) {
            this.camera.position.fromArray(this.vrFrameData.pose.position);
            this.poseResetFix();
            this.camera.position.applyQuaternion(this.quaternion);
            this.camera.position.add(this.position);
        } else {
            this.camera.position.copy(this.position);
        }
        if(this.standing) {
            this.camera.position.applyMatrix4(this.standingTransform);
        }
        if (this.vrFrameData.pose && this.vrFrameData.pose.orientation) {
            this.camera.quaternion.fromArray(this.vrFrameData.pose.orientation);
            this.camera.quaternion.premultiply(this.quaternion);
        }
    }

    set eyeHeight(height) {
        this.standingTransform.makeTranslation(0, height, 0);
    }
}