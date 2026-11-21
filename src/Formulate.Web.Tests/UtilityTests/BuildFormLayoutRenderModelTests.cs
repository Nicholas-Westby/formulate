using Formulate.Core.FormFields;
using Formulate.Core.Forms;
using Formulate.Core.Layouts;
using Formulate.Web.Tests.PersistenceTests;
using Formulate.Web.Utilities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Formulate.Web.Tests.UtilityTests
{
    public class BuildFormLayoutRenderModelTests
    {
        [Fact]
        public void BuildForm_logs_and_skips_fields_whose_kind_is_not_installed()
        {
            var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.NewGuid() };
            var form = new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { field } };
            var forms = new Mock<IFormEntityRepository>();
            forms.Setup(x => x.Get(form.Id)).Returns(form);
            var fieldFactory = new Mock<IFormFieldFactory>();
            fieldFactory.Setup(x => x.Create(field)).Returns((IFormField)null!);
            var logger = new CapturingLogger<BuildFormLayoutRenderModel>();
            var builder = new BuildFormLayoutRenderModel(forms.Object, fieldFactory.Object,
                new FormFieldDefinitionCollection(() => Array.Empty<IFormFieldDefinition>()),
                Mock.Of<ILayoutEntityRepository>(), Mock.Of<ILayoutFactory>(), logger);

            var result = builder.BuildForm(form.Id);

            Assert.Null(result);
            var entry = Assert.Single(logger.Entries, x => x.Level == LogLevel.Warning);
            Assert.Contains(field.Id.ToString(), entry.Message);
            Assert.Contains(form.Id.ToString(), entry.Message);
        }
    }
}
