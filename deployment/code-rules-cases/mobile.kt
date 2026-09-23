import com.google.firebase.analytics.FirebaseAnalytics //! PRIV-01
import com.appsflyer.AppsFlyerLib //! PRIV-01
val perms = arrayOf(android.Manifest.permission.CAMERA) //! -
val ok = checkSelfPermission("android.permission.READ_CONTACTS") //! PRIV-11
val cam = checkSelfPermission("android.permission.CAMERA") //! PRIV-11
