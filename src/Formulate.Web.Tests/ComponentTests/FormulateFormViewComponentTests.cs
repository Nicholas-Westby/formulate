using Formulate.Core;
using Formulate.Core.Layouts;
using Formulate.Core.Templates;
using Formulate.Web.Components;
using Formulate.Web.Tests.PersistenceTests;
using Formulate.Web.Utilities;
using Microsoft.AspNetCore.Mvc.ViewComponents;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Formulate.Web.Tests.ComponentTests
{
    public class FormulateFormViewComponentTests
    {
        public static TheoryData<Guid?> MissingTemplates => new() { (Guid?)null, Guid.Parse("99999999-0000-0000-0000-000000000009") };

        [Theory]
        [MemberData(nameof(MissingTemplates))]
        public void A_layout_whose_template_is_not_installed_renders_nothing_and_logs_a_warning(Guid? templateId)
        {
            var layout = new PersistedLayout { Id = Guid.NewGuid(), Name = "Main layout", TemplateId = templateId };
            var layouts = new Mock<ILayoutEntityRepository>();
            layouts.Setup(x => x.Get(layout.Id)).Returns(layout);
            var renderModel = new Mock<IBuildFormLayoutRenderModel>();
            var logger = new CapturingLogger<FormulateFormViewComponent>();
            var component = new FormulateFormViewComponent(
                layouts.Object,
                new TemplateDefinitionCollection(() => Array.Empty<ITemplateDefinition>()),
                renderModel.Object,
                logger);

            var result = component.Invoke(new FormLayout { FormId = Guid.NewGuid(), LayoutId = layout.Id });

            Assert.IsType<HtmlContentViewComponentResult>(result);
            renderModel.Verify(x => x.Build(It.IsAny<FormLayout>()), Times.Never);
            var entry = Assert.Single(logger.Entries);
            Assert.Equal(LogLevel.Warning, entry.Level);
            Assert.Contains("Main layout", entry.Message);
            Assert.Contains(layout.Id.ToString(), entry.Message);
            Assert.Contains(templateId?.ToString() ?? "no template", entry.Message);
        }
    }
}
