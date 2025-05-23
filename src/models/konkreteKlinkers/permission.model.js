const permissionSchema = new mongoose.Schema({
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User schema
      required: true,
    },
    module: {
      type: String, // Name of the module (e.g., "Products", "Orders")
      required: true,
    },
    actions: {
      type: Map, // Stores key-value pairs for actions
      of: Boolean, // Each action is either allowed (true) or denied (false)
      default: {}, // Example: { "view": true, "create": false, "update_status": true }
    },
  });
  
  export const Permission = mongoose.model("Permission", permissionSchema);


//   async function checkPermission(req, res, next) {
//     const { userId } = req; // Assume userId is available in the request
//     const { module, action } = req.params; // Module and action from the route
  
//     // Fetch user and permissions
//     const user = await User.findById(userId);
  
//     const permission = user.permissions.find((perm) => perm.module === module);
  
//     if (!permission || !permission.actions.get(action)) {
//       return res.status(403).json({ message: "Access Denied" });
//     }
  
//     next();
//   }
  
  