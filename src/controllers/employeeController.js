import { Employee } from "../models/employee.model.js";
import mongoose from 'mongoose';
import Joi from 'joi';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { formatDateToIST } from '../utils/formatDate.js';
import { factoryPermissions } from "../models/permissions.model.js";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import {User} from "../models/user.model.js";

// Helper function to send ApiResponse
const sendResponse = (res, response) => {
    return res.status(response.statusCode).json({
        statusCode: response.statusCode,
        success: response.success,
        message: response.message,
        data: response.data,
    });
};

// Create a new employee
// const createEmployee = asyncHandler(async (req, res) => {
//     // 1. Validation schema
//     const employeeSchema = Joi.object({
//         name: Joi.string().required().messages({
//             'string.empty': 'Name is required',
//         }),
//         email: Joi.string()
//             .email()
//             .required()
//             .messages({
//                 'string.email': 'Email must be a valid email address',
//                 'string.empty': 'Email is required',
//             }),
//         phoneNumber: Joi.string()
//             .pattern(/^[0-9]{10}$/)
//             .optional()
//             .allow(null, '')
//             .messages({
//                 'string.pattern.base': 'Phone number must be a 10-digit number',
//             }),
//         emp_code: Joi.string().required().messages({
//             'string.empty': 'Employee code is required',
//         }),
//         factory: Joi.string().required().messages({
//             'string.empty': 'Factory is required',
//         }),
//         role: Joi.string().required().messages({
//             'string.empty': 'Role is required',
//         }),
//         address: Joi.string().required().messages({
//             'string.empty': 'Address is required',
//         }),
//          permissions: Joi.array().items(
//             Joi.object({
//                 module: Joi.string().required(),
//                 create: Joi.boolean().optional(),
//                 read: Joi.boolean().optional(),
//                 update: Joi.boolean().optional(),
//                 updateStatus: Joi.boolean().optional(),
//                 delete: Joi.boolean().optional(),
//                 enabled: Joi.boolean().optional() // Optional flag for UI toggle
//             })
//         ).optional(),
//     });

//     // 2. Parse request body
//     const bodyData = req.body;
//     console.log('bodyData', bodyData);

//     // 3. Validate with Joi
//     const { error, value } = employeeSchema.validate(bodyData, { abortEarly: false });
//     if (error) {
//         throw new ApiError(400, 'Validation failed for employee creation', error.details);
//     }
//     // Apply rule: If module is disabled, set all CRUD permissions to false
//     let permissionsToSave = [];
//     if (value.permissions && value.permissions.length > 0) {
//         permissionsToSave = value.permissions.map(p => {
//             if (p.enabled === false || p.enabled === undefined) {
//                 return {
//                     module: p.module,
//                     create: false,
//                     read: false,
//                     update: false,
//                     updateStatus: false,
//                     delete: false
//                 };
//             }
//             return {
//                 module: p.module,
//                 create: !!p.create,
//                 read: !!p.read,
//                 update: !!p.update,
//                 updateStatus: !!p.updateStatus,
//                 delete: !!p.delete
//             };
//         });
//     }
//     // 4. Create employee data
//     const employeeData = {
//         name: value.name,
//         email: value.email,
//         phoneNumber: value.phoneNumber || null, // Handle optional phoneNumber
//         emp_code: value.emp_code,
//         factory: value.factory,
//         role: value.role,
//         address: value.address,
//         permissions: permissionsToSave,
//     };

//     // 5. Save to MongoDB
//     const employee = await Employee.create(employeeData);

//     // 6. Fetch created employee
//     const createdEmployee = await Employee.findById(employee._id).lean();

//     if (!createdEmployee) {
//         throw new ApiError(404, 'Failed to retrieve created employee');
//     }

//     // 7. Format timestamps to IST
//     const formattedEmployee = formatDateToIST(createdEmployee);

//     return sendResponse(res, new ApiResponse(201, formattedEmployee, 'Employee created successfully'));
// });

const createEmployee = asyncHandler(async (req, res) => {
    // Validation schema
    const employeeSchema = Joi.object({
        name: Joi.string().required().messages({
            'string.empty': 'Name is required',
        }),
        email: Joi.string()
            .email()
            .required()
            .messages({
                'string.email': 'Email must be a valid email address',
                'string.empty': 'Email is required',
            }),
        phoneNumber: Joi.string()
            .pattern(/^[0-9]{10}$/)
            .optional()
            .allow(null, '')
            .messages({
                'string.pattern.base': 'Phone number must be a 10-digit number',
            }),
        emp_code: Joi.string().required().messages({
            'string.empty': 'Employee code is required',
        }),
        factory: Joi.string().required().messages({
            'string.empty': 'Factory is required',
        }),
        role: Joi.string().required().messages({
            'string.empty': 'Role is required',
        }),
        address: Joi.string().required().messages({
            'string.empty': 'Address is required',
        }),
        permissions: Joi.array().items(
            Joi.object({
                module: Joi.string(),
                type: Joi.string().valid('standard', 'tab').required(),
                enabled: Joi.boolean().required(),
                create: Joi.when('type', {
                    is: 'standard',
                    then: Joi.boolean().when('enabled', {
                        is: true,
                        then: Joi.boolean().required(),
                        otherwise: Joi.boolean().valid(false).required()
                    })
                }).optional(),
                read: Joi.when('type', {
                    is: 'standard',
                    then: Joi.boolean().when('enabled', {
                        is: true,
                        then: Joi.boolean().required(),
                        otherwise: Joi.boolean().valid(false).required()
                    })
                }).optional(),
                update: Joi.when('type', {
                    is: 'standard',
                    then: Joi.boolean().when('enabled', {
                        is: true,
                        then: Joi.boolean().required(),
                        otherwise: Joi.boolean().valid(false).required()
                    })
                }).optional(),
                updateStatus: Joi.when('type', {
                    is: 'standard',
                    then: Joi.boolean().when('enabled', {
                        is: true,
                        then: Joi.boolean().required(),
                        otherwise: Joi.boolean().valid(false).required()
                    })
                }).optional(),
                delete: Joi.when('type', {
                    is: 'standard',
                    then: Joi.boolean().when('enabled', {
                        is: true,
                        then: Joi.boolean().required(),
                        otherwise: Joi.boolean().valid(false).required()
                    })
                }).optional(),
                tabs: Joi.when('type', {
                    is: 'tab',
                    then: Joi.array().items(
                        Joi.object({
                            name: Joi.string().required(),
                            enabled: Joi.boolean().required()
                        })
                    ).when('enabled', {
                        is: true,
                        then: Joi.array().min(1).required(),
                        otherwise: Joi.array().optional()
                    })
                }).optional()
            })
        ).optional(),
        password: Joi.string().required().messages({
            'string.empty': 'Password is required',
        }),
    });

    // Validate request body
    const { error, value } = employeeSchema.validate(req.body, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Validation failed', error.details);
    }

    // Process permissions
    // const permissionsToSave = value.permissions?.map(permission => {
    //     if (permission.type === 'standard') {
    //         return {
    //             module: permission.module,
    //             type: 'standard',
    //             enabled: permission.enabled,
    //             create: permission.enabled ? permission.create : false,
    //             read: permission.enabled ? permission.read : false,
    //             update: permission.enabled ? permission.update : false,
    //             updateStatus: permission.enabled ? permission.updateStatus : false,
    //             delete: permission.enabled ? permission.delete : false
    //         };
    //     } else {
    //         return {
    //             module: permission.module,
    //             type: 'tab',
    //             enabled: permission.enabled,
    //             tabs: permission.tabs?.map(tab => ({
    //                 name: tab.name,
    //                 enabled: permission.enabled ? tab.enabled : false
    //             })) || []
    //         };
    //     }
    // }) || [];
    // Apply rule: If module is disabled, set all permissions to false
// Process permissions to maintain exact payload structure
    const permissionsToSave = value.permissions?.map(permission => {
        const basePermission = {
            module: permission.module,
            type: permission.type,
            enabled: permission.enabled
        };

        if (permission.type === 'standard') {
            return {
                ...basePermission,
                create: permission.create || false,
                read: permission.read || false,
                update: permission.update || false,
                updateStatus: permission.updateStatus || false,
                delete: permission.delete || false
            };
        } else {
            return {
                ...basePermission,
                tabs: permission.tabs?.map(tab => ({
                    name: tab.name,
                    enabled: tab.enabled || false
                })) || []
            };
        }
    }) || [];

    // Create employee data
    const employeeData = {
        name: value.name,
        email: value.email,
        phoneNumber: value.phoneNumber || null,
        emp_code: value.emp_code,
        factory: value.factory,
        role: value.role,
        address: value.address,
        permissions: permissionsToSave,
        password: value.password
    };

    // Save to database
    const employee = await Employee.create(employeeData);

    const employeeDatatoUser = {
        username: value.name,
        username : value.name,
        email: value.email,
        // userType: value.role,
         userType: "Employee", 
        password: value.password,
        phoneNumber: value.phoneNumber || null,
    };
        const employeetoUSer = await User.create(employeeDatatoUser);

    // Return success response
    return sendResponse(
        res,
        new ApiResponse(201, employee, 'Employee created successfully')
    );
});

const getEmployees = asyncHandler(async (req, res) => {
    console.log("inside......get");
    const employees = await Employee
      .find();
    //   .select('_id name')
    //   .lean();
  
    if (!employees?.length) {
      return sendResponse(res, new ApiResponse(200, [], 'No employees found'));
    }
  
    return sendResponse(res, new ApiResponse(200, employees, 'Employees fetched successfully'));
  });
  

  //Login

//    const employeeLogin = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // Check if employee exists
//     const employee = await Employee.findOne({ email });
//     if (!employee) {
//       return res.status(404).json({ message: "Employee not found" });
//     }

//     // Compare password
//     const isMatch = await bcrypt.compare(password, employee.password);
//     if (!isMatch) {
//       return res.status(400).json({ message: "Invalid credentials" });
//     }

//     // Generate JWT
//     const token = jwt.sign(
//       { id: employee._id, role: employee.role, type: "employee" },
//       process.env.ACCESS_TOKEN_SECRET,
//       { expiresIn: "1d" }
//     );

//     res.status(200).json({
//       message: "Employee login successful",
//       token,
//       employee: {
//         id: employee._id,
//         name: employee.name,
//         email: employee.email,
//         role: employee.role,
//         factory: employee.factory
//       }
//     });
//   } catch (err) {
//     console.error("Employee Login Error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

export { createEmployee,getEmployees };