import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as studentService from "../services/student.service";
import type {
  CreateStudentInput,
  UpdateStudentInput,
  StudentIdParam,
  ListStudentsQuery,
} from "../schemas/student.schema";

/**
 * Student controllers — thin handlers (CLAUDE.md).
 * They extract the already-validated input, call ONE service method, and send
 * the response. No business logic, no try/catch.
 *
 * `actor` is built from req.user (set by authenticate). We pass it as plain data
 * so the service stays free of Express types but can still authorize the action.
 */

/**
 * @description List students, optionally filtered by ?classId= and ?status=
 * @route   GET /api/students
 * @access  ADMIN, OPERATOR
 * **/

export const listStudents = asyncHandler(async (req: Request, res: Response) => {
  const data = await studentService.listStudents(
    req.query as unknown as ListStudentsQuery
  );
  res.status(200).json({ success: true, data });
});

/**
 * @description Enroll a new student (always ACTIVE)
 * @route   POST /api/students
 * @access  ADMIN, OPERATOR (operator only in authorized classes)
 * **/

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  const { userId, role } = req.user!;
  const data = await studentService.createStudent(
    req.body as CreateStudentInput,
    { userId, role }
  );
  res.status(201).json({ success: true, data });
});

/**
 * @description Update a student's info and/or status
 * @route   PUT /api/students/:id
 * @access  ADMIN, OPERATOR (operator only in authorized classes)
 * **/

export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  const { userId, role } = req.user!;
  const { id } = req.params as unknown as StudentIdParam;
  const data = await studentService.updateStudent(
    id,
    req.body as UpdateStudentInput,
    { userId, role }
  );
  res.status(200).json({ success: true, data });
});
