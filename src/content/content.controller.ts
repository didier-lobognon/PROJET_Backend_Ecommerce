import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ContentService } from './content.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { CreateContactRequestDto } from './dto/contact.dto';
import { UpdateTestimonialDto } from './dto/testimonial.dto';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  // ─── Public endpoints ───────────────────────────────────────────────────────

  @Get('posts')
  @ApiOperation({ summary: 'Articles publiés (public)' })
  @ApiQuery({ name: 'page', required: false })
  getPublishedPosts(@Query('page') page?: string) {
    return this.contentService.getPublishedPosts(page ? +page : 1);
  }

  @Get('posts/:slug')
  @ApiOperation({ summary: 'Article par slug (public)' })
  getPostBySlug(@Param('slug') slug: string) {
    return this.contentService.getPostBySlug(slug);
  }

  @Get('projects')
  @ApiOperation({ summary: 'Réalisations publiées (public)' })
  getPublishedProjects() {
    return this.contentService.getPublishedProjects();
  }

  @Get('projects/:slug')
  @ApiOperation({ summary: 'Réalisation par slug (public)' })
  getProjectBySlug(@Param('slug') slug: string) {
    return this.contentService.getProjectBySlug(slug);
  }

  @Get('courses')
  @ApiOperation({ summary: 'Formations publiées (public)' })
  getPublishedCourses() {
    return this.contentService.getPublishedCourses();
  }

  @Get('courses/:slug')
  @ApiOperation({ summary: 'Formation par slug (public)' })
  getCourseBySlug(@Param('slug') slug: string) {
    return this.contentService.getCourseBySlug(slug);
  }

  @Get('testimonials')
  @ApiOperation({ summary: 'Témoignages visibles (public)' })
  getTestimonials() {
    return this.contentService.getVisibleTestimonials();
  }

  @Post('contact')
  @ApiOperation({ summary: 'Envoyer une demande de contact' })
  createContact(@Body() dto: CreateContactRequestDto) {
    return this.contentService.createContactRequest(dto);
  }

  // ─── Admin endpoints ────────────────────────────────────────────────────────

  @Get('admin/posts')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Tous les articles (admin)' })
  getAllPosts() {
    return this.contentService.getAllPosts();
  }

  @Post('admin/posts')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Créer un article' })
  createPost(@Body() dto: CreatePostDto, @CurrentUser('sub') userId: string) {
    return this.contentService.createPost(dto, userId);
  }

  @Patch('admin/posts/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Modifier un article' })
  updatePost(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.contentService.updatePost(id, dto);
  }

  @Delete('admin/posts/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Supprimer un article' })
  deletePost(@Param('id') id: string) {
    return this.contentService.deletePost(id);
  }

  @Get('admin/projects')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Toutes les réalisations (admin)' })
  getAllProjects() {
    return this.contentService.getAllProjects();
  }

  @Post('admin/projects')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Créer une réalisation' })
  createProject(@Body() dto: CreateProjectDto) {
    return this.contentService.createProject(dto);
  }

  @Patch('admin/projects/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Modifier une réalisation' })
  updateProject(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.contentService.updateProject(id, dto);
  }

  @Delete('admin/projects/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Supprimer une réalisation' })
  deleteProject(@Param('id') id: string) {
    return this.contentService.deleteProject(id);
  }

  @Get('admin/courses')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Toutes les formations (admin)' })
  getAllCourses() {
    return this.contentService.getAllCourses();
  }

  @Post('admin/courses')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Créer une formation' })
  createCourse(@Body() dto: CreateCourseDto) {
    return this.contentService.createCourse(dto);
  }

  @Patch('admin/courses/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Modifier une formation' })
  updateCourse(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.contentService.updateCourse(id, dto);
  }

  @Delete('admin/courses/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Supprimer une formation' })
  deleteCourse(@Param('id') id: string) {
    return this.contentService.deleteCourse(id);
  }

  @Post('admin/testimonials')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Ajouter un témoignage' })
  createTestimonial(@Body() data: { authorName: string; company?: string; content: string; rating?: number }) {
    return this.contentService.createTestimonial(data);
  }

  @Get('admin/testimonials')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Tous les témoignages (admin)' })
  getAllTestimonials() {
    return this.contentService.getAllTestimonials();
  }

  @Patch('admin/testimonials/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Modifier un témoignage' })
  updateTestimonial(@Param('id') id: string, @Body() dto: UpdateTestimonialDto) {
    return this.contentService.updateTestimonial(id, dto);
  }

  @Delete('admin/testimonials/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Supprimer un témoignage' })
  deleteTestimonial(@Param('id') id: string) {
    return this.contentService.deleteTestimonial(id);
  }

  @Get('admin/contacts')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Liste demandes de contact' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'isRead', required: false, enum: ['true', 'false'] })
  getContacts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isRead') isRead?: string,
  ) {
    const readFilter =
      isRead === 'true' ? true : isRead === 'false' ? false : undefined;
    return this.contentService.getContactRequests(
      page ? +page : 1,
      limit ? +limit : 20,
      readFilter,
    );
  }

  @Patch('admin/contacts/:id/read')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Marquer comme lu' })
  markContactRead(@Param('id') id: string) {
    return this.contentService.markContactAsRead(id);
  }
}
