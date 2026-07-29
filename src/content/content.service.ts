import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { CreateContactRequestDto } from './dto/contact.dto';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Posts ──────────────────────────────────────────────────────────────────

  async createPost(dto: CreatePostDto, authorId?: string) {
    return this.prisma.post.create({
      data: {
        ...dto,
        authorId,
        publishedAt: dto.status === ContentStatus.PUBLISHED ? new Date() : null,
      },
    });
  }

  async updatePost(id: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Article introuvable');

    const publishedAt =
      dto.status === ContentStatus.PUBLISHED && !post.publishedAt
        ? new Date()
        : post.publishedAt;

    return this.prisma.post.update({
      where: { id },
      data: { ...dto, publishedAt },
    });
  }

  async deletePost(id: string) {
    return this.prisma.post.delete({ where: { id } });
  }

  async getPublishedPosts(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { status: ContentStatus.PUBLISHED },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where: { status: ContentStatus.PUBLISHED } }),
    ]);
    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getPostBySlug(slug: string) {
    const post = await this.prisma.post.findUnique({ where: { slug } });
    if (!post || post.status !== ContentStatus.PUBLISHED) {
      throw new NotFoundException('Article introuvable');
    }
    return post;
  }

  async getAllPosts() {
    return this.prisma.post.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // ─── Projects ───────────────────────────────────────────────────────────────

  async createProject(dto: CreateProjectDto) {
    return this.prisma.project.create({ data: dto });
  }

  async updateProject(id: string, dto: UpdateProjectDto) {
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async deleteProject(id: string) {
    return this.prisma.project.delete({ where: { id } });
  }

  async getPublishedProjects() {
    return this.prisma.project.findMany({
      where: { status: ContentStatus.PUBLISHED },
      orderBy: { completedAt: 'desc' },
    });
  }

  async getProjectBySlug(slug: string) {
    const project = await this.prisma.project.findUnique({ where: { slug } });
    if (!project || project.status !== ContentStatus.PUBLISHED) {
      throw new NotFoundException('Réalisation introuvable');
    }
    return project;
  }

  async getAllProjects() {
    return this.prisma.project.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // ─── Courses ────────────────────────────────────────────────────────────────

  async createCourse(dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        ...dto,
        publishedAt: dto.status === ContentStatus.PUBLISHED ? new Date() : null,
      },
    });
  }

  async updateCourse(id: string, dto: UpdateCourseDto) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Formation introuvable');

    const publishedAt =
      dto.status === ContentStatus.PUBLISHED && !course.publishedAt
        ? new Date()
        : course.publishedAt;

    return this.prisma.course.update({ where: { id }, data: { ...dto, publishedAt } });
  }

  async deleteCourse(id: string) {
    return this.prisma.course.delete({ where: { id } });
  }

  async getPublishedCourses() {
    return this.prisma.course.findMany({
      where: { status: ContentStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async getCourseBySlug(slug: string) {
    const course = await this.prisma.course.findUnique({ where: { slug } });
    if (!course || course.status !== ContentStatus.PUBLISHED) {
      throw new NotFoundException('Formation introuvable');
    }
    return course;
  }

  async getAllCourses() {
    return this.prisma.course.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // ─── Testimonials ──────────────────────────────────────────────────────────

  async getVisibleTestimonials() {
    return this.prisma.testimonial.findMany({
      where: { isVisible: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllTestimonials() {
    return this.prisma.testimonial.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createTestimonial(data: {
    authorName: string;
    company?: string;
    content: string;
    rating?: number;
    isVisible?: boolean;
  }) {
    return this.prisma.testimonial.create({ data });
  }

  async updateTestimonial(
    id: string,
    data: { authorName?: string; company?: string; content?: string; rating?: number; isVisible?: boolean },
  ) {
    const testimonial = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!testimonial) throw new NotFoundException('Témoignage introuvable');

    return this.prisma.testimonial.update({ where: { id }, data });
  }

  async deleteTestimonial(id: string) {
    return this.prisma.testimonial.delete({ where: { id } });
  }

  // ─── Contact ────────────────────────────────────────────────────────────────

  async createContactRequest(dto: CreateContactRequestDto) {
    return this.prisma.contactRequest.create({ data: dto });
  }

  async getContactRequests(
    page = 1,
    limit = 20,
    isRead?: boolean,
  ) {
    const skip = (page - 1) * limit;
    const where = isRead === undefined ? {} : { isRead };
    const [items, total] = await Promise.all([
      this.prisma.contactRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contactRequest.count({ where }),
    ]);
    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async markContactAsRead(id: string) {
    return this.prisma.contactRequest.update({
      where: { id },
      data: { isRead: true },
    });
  }
}
