import { validate } from 'class-validator';
import { CreateProjectDto } from './create-project.dto';

describe('CreateProjectDto', () => {
  it('accepts localhost base URLs for local demos', async () => {
    const dto = new CreateProjectDto();
    dto.name = 'Local demo';
    dto.baseUrl = 'http://localhost:3000';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects non-URL base URLs', async () => {
    const dto = new CreateProjectDto();
    dto.name = 'Broken demo';
    dto.baseUrl = 'localhost:3000';

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('baseUrl');
  });
});
