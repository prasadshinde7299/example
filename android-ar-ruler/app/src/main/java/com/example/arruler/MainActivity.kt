package com.example.arruler

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.gorisse.thomas.sceneform.Sceneform
import com.gorisse.thomas.sceneform.math.MathHelper
import com.gorisse.thomas.sceneform.math.Position
import com.gorisse.thomas.sceneform.math.Rotation
import com.gorisse.thomas.sceneform.rendering.Color
import com.gorisse.thomas.sceneform.rendering.MaterialFactory
import com.gorisse.thomas.sceneform.rendering.ModelRenderable
import com.gorisse.thomas.sceneform.rendering.ShapeFactory
import com.gorisse.thomas.sceneform.ux.ArFragment
import com.gorisse.thomas.sceneform.ux.TransformableNode
import com.google.ar.core.Anchor
import com.google.ar.core.HitResult
import com.google.ar.core.Plane
import com.google.ar.core.TrackingState
import java.util.concurrent.CompletableFuture
import kotlin.math.round

class MainActivity : AppCompatActivity() {

    private lateinit var arFragment: ArFragment
    private lateinit var distanceText: TextView
    private lateinit var resetButton: Button
    private lateinit var unitButton: Button

    private var unit: String = "m" // m | cm | in

    private var firstAnchor: Anchor? = null
    private var secondAnchor: Anchor? = null

    private var sphereRenderable: ModelRenderable? = null
    private var lineRenderable: ModelRenderable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)

        if (!Sceneform.isSupported(this)) {
            finish()
            return
        }

        arFragment = supportFragmentManager.findFragmentById(R.id.arFragment) as ArFragment
        distanceText = findViewById(R.id.distanceText)
        resetButton = findViewById(R.id.resetButton)
        unitButton = findViewById(R.id.unitButton)

        maybeRequestCameraPermission()
        prepareRenderables()

        arFragment.setOnTapArPlaneListener { hitResult: HitResult, plane: Plane, _ ->
            if (plane.trackingState != TrackingState.TRACKING) return@setOnTapArPlaneListener
            placePoint(hitResult)
        }

        resetButton.setOnClickListener { resetMeasurement() }
        unitButton.setOnClickListener {
            unit = when (unit) {
                "m" -> "cm"
                "cm" -> "in"
                else -> "m"
            }
            unitButton.text = getString(R.string.units, unit)
            updateDistanceLabel()
        }
    }

    private fun maybeRequestCameraPermission() {
        val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), 1)
        }
    }

    private fun prepareRenderables() {
        val sphereFuture = MaterialFactory.makeOpaqueWithColor(this, Color(1.0f, 0.82f, 0.25f))
            .thenApply { material ->
                ShapeFactory.makeSphere(0.01f, Position(0f, 0f, 0f), material)
            }

        val lineFuture = MaterialFactory.makeOpaqueWithColor(this, Color(1.0f, 0.76f, 0.25f))
            .thenApply { material ->
                // Unit line, we will scale it later
                ShapeFactory.makeCube(Position(0.0025f, 0.0025f, 1f), Position(0f, 0f, 0.5f), material)
            }

        CompletableFuture.allOf(sphereFuture, lineFuture).thenAccept {
            sphereRenderable = sphereFuture.get()
            lineRenderable = lineFuture.get()
        }
    }

    private fun placePoint(hitResult: HitResult) {
        val anchor = hitResult.createAnchor()
        val node = TransformableNode(arFragment.transformationSystem).apply {
            renderable = sphereRenderable
            setParent(arFragment.arSceneView.scene)
            worldPosition = Position(anchor.pose.tx(), anchor.pose.ty(), anchor.pose.tz())
            isEnabled = false
        }

        if (firstAnchor == null) {
            firstAnchor = anchor
            distanceText.text = getString(R.string.distance_placeholder)
        } else if (secondAnchor == null) {
            secondAnchor = anchor
            drawOrUpdateLine()
        } else {
            resetMeasurement()
            firstAnchor = anchor
        }
    }

    private fun drawOrUpdateLine() {
        val anchorA = firstAnchor ?: return
        val anchorB = secondAnchor ?: return

        val posA = Position(anchorA.pose.tx(), anchorA.pose.ty(), anchorA.pose.tz())
        val posB = Position(anchorB.pose.tx(), anchorB.pose.ty(), anchorB.pose.tz())

        val diff = Position.subtract(posB, posA)
        val distance = MathHelper.length(diff)

        val center = Position.add(posA, Position.multiply(diff, 0.5f))
        val direction = MathHelper.normalize(diff)

        // Create or update a node for the line
        val existing = arFragment.arSceneView.scene.children.firstOrNull { it.name == "measure_line" }
        val lineNode = existing ?: TransformableNode(arFragment.transformationSystem).apply {
            name = "measure_line"
            renderable = lineRenderable
            setParent(arFragment.arSceneView.scene)
            isEnabled = false
        }

        // Scale along Z to match length, keep thickness small
        lineNode.worldScale = Position(1f, 1f, distance)
        lineNode.worldPosition = center

        // Compute rotation to align with diff vector
        val forward = Position(0f, 0f, 1f)
        val rotationQuat = MathHelper.rotationBetweenVectors(forward, direction)
        lineNode.worldRotation = Rotation(rotationQuat.x, rotationQuat.y, rotationQuat.z, rotationQuat.w)

        updateDistanceLabel(distance)
    }

    private fun updateDistanceLabel(currentMeters: Float? = null) {
        val meters = currentMeters ?: run {
            val a = firstAnchor ?: return
            val b = secondAnchor ?: return
            val pa = Position(a.pose.tx(), a.pose.ty(), a.pose.tz())
            val pb = Position(b.pose.tx(), b.pose.ty(), b.pose.tz())
            MathHelper.length(Position.subtract(pb, pa))
        }
        val text = when (unit) {
            "cm" -> String.format("%.1f cm", meters * 100f)
            "in" -> String.format("%.2f in", meters * 39.37007874f)
            else -> String.format("%.3f m", meters)
        }
        distanceText.text = text
    }

    private fun resetMeasurement() {
        firstAnchor?.detach()
        secondAnchor?.detach()
        firstAnchor = null
        secondAnchor = null

        val existing = arFragment.arSceneView.scene.children.firstOrNull { it.name == "measure_line" }
        if (existing != null) {
            existing.setParent(null)
        }

        distanceText.text = getString(R.string.distance_placeholder)
    }
}

