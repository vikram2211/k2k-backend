import { Employee } from "../models/employee.model.js";
import mongoose from 'mongoose';
import Joi from 'joi';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { formatDateToIST } from '../utils/formatDate.js';

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
const createEmployee = asyncHandler(async (req, res) => {
    // 1. Validation schema
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
    });

    // 2. Parse request body
    const bodyData = req.body;
    console.log('bodyData', bodyData);

    // 3. Validate with Joi
    const { error, value } = employeeSchema.validate(bodyData, { abortEarly: false });
    if (error) {
        throw new ApiError(400, 'Validation failed for employee creation', error.details);
    }

    // 4. Create employee data
    const employeeData = {
        name: value.name,
        email: value.email,
        phoneNumber: value.phoneNumber || null, // Handle optional phoneNumber
        emp_code: value.emp_code,
        factory: value.factory,
        role: value.role,
        address: value.address,
    };

    // 5. Save to MongoDB
    const employee = await Employee.create(employeeData);

    // 6. Fetch created employee
    const createdEmployee = await Employee.findById(employee._id).lean();

    if (!createdEmployee) {
        throw new ApiError(404, 'Failed to retrieve created employee');
    }

    // 7. Format timestamps to IST
    const formattedEmployee = formatDateToIST(createdEmployee);

    return sendResponse(res, new ApiResponse(201, formattedEmployee, 'Employee created successfully'));
});
const getEmployees = asyncHandler(async (req, res) => {
    console.log("inside......get");
    const employees = await Employee
      .find()
      .select('_id name')
      .lean();
  
    if (!employees?.length) {
      return sendResponse(res, new ApiResponse(200, [], 'No employees found'));
    }
  
    return sendResponse(res, new ApiResponse(200, employees, 'Employees fetched successfully'));
  });
  

export { createEmployee,getEmployees };