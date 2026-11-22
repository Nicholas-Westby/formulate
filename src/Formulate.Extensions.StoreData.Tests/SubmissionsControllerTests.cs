using Asp.Versioning;
using Formulate.BackOffice.Api.Filters;
using Formulate.BackOffice.Api.Services;
using Formulate.Extensions.StoreData.Api;
using Formulate.Extensions.StoreData.Api.Models;
using Formulate.Extensions.StoreData.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Umbraco.Cms.Api.Common.ViewModels.Pagination;
using Umbraco.Cms.Api.Management.Routing;
using Xunit;

namespace Formulate.Extensions.StoreData.Tests;

public sealed class SubmissionsControllerTests
{
    private readonly Mock<ISubmissionQueryService> _service = new();

    private SubmissionsController CreateController() => new(_service.Object)
    {
        ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
    };

    [Fact]
    public void The_controller_requires_the_section_and_routes_under_formulate_submission()
    {
        var type = typeof(SubmissionsController);

        Assert.NotEmpty(type.GetCustomAttributes(typeof(RequireFormulateSectionAttribute), true));
        Assert.NotEmpty(type.GetCustomAttributes(typeof(ApiVersionAttribute), false));
        var route = Assert.Single(type.GetCustomAttributes(typeof(VersionedApiBackOfficeRouteAttribute), false).Cast<VersionedApiBackOfficeRouteAttribute>());
        Assert.EndsWith("/formulate/submission", route.Template);
    }

    [Fact]
    public void Statuses_map_to_problem_details()
    {
        var id = Guid.NewGuid();
        _service.Setup(x => x.Get(id)).Returns(ServiceResult<SubmissionResponseModel>.NotFound("gone"));
        _service.Setup(x => x.List(id, 0, 0)).Returns(ServiceResult<PagedViewModel<SubmissionResponseModel>>.Invalid("take", "bad"));
        _service.Setup(x => x.Delete(id)).Returns(ServiceResult<bool>.NotFound("gone"));
        _service.Setup(x => x.GetFile(id, id, "a")).Returns(ServiceResult<SubmissionFileDownload>.NotFound("gone"));
        _service.Setup(x => x.Export(id)).Returns(ServiceResult<Stream>.NotFound("gone"));
        var controller = CreateController();

        Assert.Equal(404, Assert.IsAssignableFrom<ObjectResult>(controller.ById(id)).StatusCode);
        Assert.Equal(404, Assert.IsAssignableFrom<ObjectResult>(controller.Delete(id)).StatusCode);
        Assert.Equal(404, Assert.IsAssignableFrom<ObjectResult>(controller.DownloadFile(id, id, "a")).StatusCode);
        Assert.Equal(404, Assert.IsAssignableFrom<ObjectResult>(controller.Export(id)).StatusCode);
        var invalid = Assert.IsAssignableFrom<ObjectResult>(controller.List(id, 0, 0));
        Assert.Equal(400, invalid.StatusCode);
        Assert.Equal("take", Assert.IsType<ProblemDetails>(invalid.Value).Extensions["field"]);
    }

    [Fact]
    public void Export_is_a_utf8_csv_attachment()
    {
        var id = Guid.NewGuid();
        using var stream = new MemoryStream(new byte[] { 0xEF, 0xBB, 0xBF, (byte)'a' });
        _service.Setup(x => x.Export(id)).Returns(ServiceResult<Stream>.Success(stream));

        var file = Assert.IsType<FileStreamResult>(CreateController().Export(id));

        Assert.Equal("text/csv; charset=utf-8", file.ContentType);
        Assert.Same(stream, file.FileStream);
        Assert.False(string.IsNullOrEmpty(file.FileDownloadName));
    }

    [Fact]
    public void A_download_is_an_opaque_attachment()
    {
        var id = Guid.NewGuid();
        _service.Setup(x => x.GetFile(id, id, "cv.pdf"))
            .Returns(ServiceResult<SubmissionFileDownload>.Success(new SubmissionFileDownload { Path = "/x/cv.pdf", FileName = "cv.pdf" }));
        var controller = CreateController();

        var file = Assert.IsType<PhysicalFileResult>(controller.DownloadFile(id, id, "cv.pdf"));

        Assert.Equal("application/octet-stream", file.ContentType);
        Assert.Equal("cv.pdf", file.FileDownloadName);
        Assert.Equal("nosniff", controller.Response.Headers["X-Content-Type-Options"]);
    }
}
